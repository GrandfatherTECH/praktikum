from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db_session
from app.models.department import Department
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.department import DepartmentCreate, DepartmentRead, DepartmentUpdate
from app.services.audit import create_audit_log

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("", response_model=list[DepartmentRead])
async def list_departments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[DepartmentRead]:
    _ = current_user
    result = await db.execute(select(Department).where(Department.is_active.is_(True)).order_by(Department.id.asc()))
    return list(result.scalars().all())


@router.post("", response_model=DepartmentRead, status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentCreate,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.CHIEF)),
    db: AsyncSession = Depends(get_db_session),
) -> DepartmentRead:
    existing = await db.execute(select(Department).where(Department.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Department already exists")

    if payload.head_user_id is not None:
        user = await db.get(User, payload.head_user_id)
        if not user:
            raise HTTPException(status_code=400, detail="Head user not found")

    department = Department(name=payload.name, head_user_id=payload.head_user_id, is_active=payload.is_active)
    db.add(department)
    await db.flush()

    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="department.created",
        entity_type="department",
        entity_id=department.id,
        after={"name": department.name, "is_active": department.is_active},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()
    await db.refresh(department)
    return department


@router.patch("/{department_id}", response_model=DepartmentRead)
async def update_department(
    department_id: int,
    payload: DepartmentUpdate,
    request: Request,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.CHIEF)),
    db: AsyncSession = Depends(get_db_session),
) -> DepartmentRead:
    department = await db.get(Department, department_id)
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    data = payload.model_dump(exclude_unset=True)
    if "head_user_id" in data and data["head_user_id"] is not None:
        user = await db.get(User, data["head_user_id"])
        if not user:
            raise HTTPException(status_code=400, detail="Head user not found")

    before = {
        "name": department.name,
        "head_user_id": department.head_user_id,
        "is_active": department.is_active,
    }
    for key, value in data.items():
        setattr(department, key, value)

    after = {
        "name": department.name,
        "head_user_id": department.head_user_id,
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
    await db.refresh(department)
    return department
