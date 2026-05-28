from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.security import generate_temporary_password
from app.db.session import get_db_session
from app.models.department import Department
from app.models.enums import UserRole
from app.models.session import Session
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.user import OneTimePasswordResponse, UserApproveResponse, UserCreate, UserRead, UserUpdate
from app.core.security import hash_password
from app.services.audit import create_audit_log

router = APIRouter(prefix="/users", tags=["users"])


def _ensure_user_management_allowed(current_user: User, role: UserRole) -> None:
    if current_user.role == UserRole.ADMIN:
        return
    if current_user.role != UserRole.CHIEF:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if role in {UserRole.ADMIN, UserRole.CHIEF}:
        raise HTTPException(status_code=403, detail="Chief cannot assign ADMIN or CHIEF role")


@router.get("", response_model=list[UserRead])
async def list_users(
    _: User = Depends(get_current_user),
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
    _ensure_user_management_allowed(current_user, payload.role)
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


@router.delete("/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own user")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    before = {
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role.value,
        "department_id": user.department_id,
    }
    await db.delete(user)

    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="user.deleted",
        entity_type="user",
        entity_id=user_id,
        before=before,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return MessageResponse(message="User deleted")


@router.post("/{user_id}/one-time-password", response_model=OneTimePasswordResponse)
async def create_one_time_password(
    user_id: int,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
) -> OneTimePasswordResponse:
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot generate a one-time password for your own user")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    temporary_password = generate_temporary_password()
    user.password_hash = hash_password(temporary_password)
    user.must_change_password = True

    await db.execute(
        update(Session)
        .where(
            (Session.user_id == user.id) & Session.revoked_at.is_(None)
        )
        .values(revoked_at=datetime.now(UTC))
    )

    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="user.one_time_password_created",
        entity_type="user",
        entity_id=user.id,
        after={"must_change_password": True},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(user)
    return OneTimePasswordResponse(
        message="One-time password created",
        temporary_password=temporary_password,
        user=user,
    )


@router.post("/{user_id}/approve", response_model=UserApproveResponse)
async def approve_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.CHIEF)),
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
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.CHIEF)),
    db: AsyncSession = Depends(get_db_session),
) -> UserRead:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    data = payload.model_dump(exclude_unset=True)
    if current_user.role == UserRole.CHIEF and "is_approved" in data:
        data.pop("is_approved")
    target_role = data.get("role", user.role)
    _ensure_user_management_allowed(current_user, target_role)
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
