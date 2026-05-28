from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db_session
from app.models.department import Department
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.department import DepartmentCreate, DepartmentRead, DepartmentUpdate
from app.services.audit import create_audit_log

router = APIRouter(prefix="/departments", tags=["departments"])


def validate_department_head_role(user: User) -> None:
    if user.role not in (UserRole.DEPARTMENT_HEAD, UserRole.CHIEF):
        raise HTTPException(status_code=400, detail="Head user must have CHIEF or DEPARTMENT_HEAD role")


def _serialize_department(department: Department) -> DepartmentRead:
    return DepartmentRead(
        id=department.id,
        name=department.name,
        head_user_id=department.head_user_id,
        member_user_ids=[user.id for user in department.users],
        is_active=department.is_active,
        created_at=department.created_at,
        updated_at=department.updated_at,
    )


@router.get("", response_model=list[DepartmentRead])
async def list_departments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[DepartmentRead]:
    _ = current_user
    result = await db.execute(
        select(Department)
        .options(selectinload(Department.users))
        .where(Department.is_active.is_(True))
        .order_by(Department.id.asc())
    )
    departments = list(result.scalars().all())
    return [_serialize_department(department) for department in departments]


@router.post("", response_model=DepartmentRead, status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentCreate,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
) -> DepartmentRead:
    existing = await db.execute(select(Department).where(Department.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Department already exists")

    if payload.head_user_id is not None:
        user = await db.get(User, payload.head_user_id)
        if not user:
            raise HTTPException(status_code=400, detail="Head user not found")
        validate_department_head_role(user)
    if payload.member_user_ids:
        members_result = await db.execute(select(User).where(User.id.in_(payload.member_user_ids)))
        members = members_result.scalars().all()
        if len(members) != len(set(payload.member_user_ids)):
            raise HTTPException(status_code=400, detail="One or more users for department membership not found")

    department = Department(name=payload.name, head_user_id=payload.head_user_id, is_active=payload.is_active)
    db.add(department)
    await db.flush()
    for user in members if payload.member_user_ids else []:
        user.department_id = department.id

    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="department.created",
        entity_type="department",
        entity_id=department.id,
        after={
            "name": department.name,
            "head_user_id": department.head_user_id,
            "member_user_ids": sorted(payload.member_user_ids),
            "is_active": department.is_active,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()
    await db.refresh(department, attribute_names=["users"])
    return _serialize_department(department)


@router.delete("/{department_id}", response_model=MessageResponse)
async def delete_department(
    department_id: int,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    department = await db.get(Department, department_id)
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    before = {
        "name": department.name,
        "head_user_id": department.head_user_id,
        "is_active": department.is_active,
    }
    await db.delete(department)

    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="department.deleted",
        entity_type="department",
        entity_id=department_id,
        before=before,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return MessageResponse(message="Department deleted")


@router.patch("/{department_id}", response_model=DepartmentRead)
async def update_department(
    department_id: int,
    payload: DepartmentUpdate,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
) -> DepartmentRead:
    result = await db.execute(select(Department).options(selectinload(Department.users)).where(Department.id == department_id))
    department = result.scalar_one_or_none()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    data = payload.model_dump(exclude_unset=True)
    if "head_user_id" in data and data["head_user_id"] is not None:
        user = await db.get(User, data["head_user_id"])
        if not user:
            raise HTTPException(status_code=400, detail="Head user not found")
        validate_department_head_role(user)
    member_user_ids: list[int] | None = data.pop("member_user_ids", None)
    if member_user_ids is not None:
        members_result = await db.execute(select(User).where(User.id.in_(member_user_ids)))
        members = members_result.scalars().all()
        if len(members) != len(set(member_user_ids)):
            raise HTTPException(status_code=400, detail="One or more users for department membership not found")

    before = {
        "name": department.name,
        "head_user_id": department.head_user_id,
        "is_active": department.is_active,
    }
    for key, value in data.items():
        setattr(department, key, value)
    if member_user_ids is not None:
        member_set = set(member_user_ids)
        for user in department.users:
            if user.id not in member_set:
                user.department_id = None
        for user in members:
            user.department_id = department.id

    after = {
        "name": department.name,
        "head_user_id": department.head_user_id,
        "member_user_ids": sorted(member_user_ids if member_user_ids is not None else [user.id for user in department.users]),
        "is_active": department.is_active,
    }

    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="department.updated",
        entity_type="department",
        entity_id=department.id,
        before=before,
        after=after,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()
    await db.refresh(department, attribute_names=["users"])
    return _serialize_department(department)
