from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db_session
from app.models.department import Department
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import UserApproveResponse, UserCreate, UserRead, UserUpdate
from app.core.security import hash_password
from app.services.audit import create_audit_log

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserRead])
async def list_users(
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.CHIEF)),
    db: AsyncSession = Depends(get_db_session),
) -> list[UserRead]:
    result = await db.execute(select(User).order_by(User.id.asc()))
    return list(result.scalars().all())


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.CHIEF)),
    db: AsyncSession = Depends(get_db_session),
) -> UserRead:
    existing = await db.execute(select(User).where(User.username == payload.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already exists")

    if payload.department_id is not None:
        dept = await db.get(Department, payload.department_id)
        if not dept:
            raise HTTPException(status_code=400, detail="Department not found")

    user = User(
        full_name=payload.full_name,
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=payload.role,
        department_id=payload.department_id,
        position=payload.position,
        is_active=payload.is_active,
        is_approved=False,
    )
    db.add(user)
    await db.flush()

    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="user.created",
        entity_type="user",
        entity_id=user.id,
        after={"username": user.username, "role": user.role.value},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/{user_id}/approve", response_model=UserApproveResponse)
async def approve_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.CHIEF)),
    db: AsyncSession = Depends(get_db_session),
) -> UserApproveResponse:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_approved = True

    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="user.approved",
        entity_type="user",
        entity_id=user.id,
        before={"is_approved": False},
        after={"is_approved": True},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(user)
    return UserApproveResponse(message="User approved", user=user)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> UserRead:
    if current_user.role not in (UserRole.ADMIN, UserRole.CHIEF):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    data = payload.model_dump(exclude_unset=True)
    if "role" in data and current_user.role not in (UserRole.ADMIN, UserRole.CHIEF):
        raise HTTPException(status_code=403, detail="Role change is forbidden")

    if "department_id" in data and data["department_id"] is not None:
        dept = await db.get(Department, data["department_id"])
        if not dept:
            raise HTTPException(status_code=400, detail="Department not found")

    before = {
        "full_name": user.full_name,
        "role": user.role.value,
        "department_id": user.department_id,
        "position": user.position,
        "is_active": user.is_active,
        "is_approved": user.is_approved,
    }

    for key, value in data.items():
        setattr(user, key, value)

    after = {
        "full_name": user.full_name,
        "role": user.role.value,
        "department_id": user.department_id,
        "position": user.position,
        "is_active": user.is_active,
        "is_approved": user.is_approved,
    }

    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="user.updated",
        entity_type="user",
        entity_id=user.id,
        before=before,
        after=after,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(user)
    return user
