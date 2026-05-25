from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import app
from app.models.audit_log import AuditLog
from app.models.department import Department
from app.models.enums import UserRole
from app.models.session import Session
from app.models.user import User


@pytest.fixture()
async def db_session() -> AsyncGenerator:
    async with SessionLocal() as session:
        await session.execute(delete(AuditLog))
        await session.execute(delete(Session))
        await session.execute(delete(User))
        await session.execute(delete(Department))
        await session.commit()
        yield session


@pytest.fixture()
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver.local") as async_client:
        yield async_client


@pytest.fixture()
async def users_fixture(db_session):
    dept = Department(name="Тестовый отдел", is_active=True)
    db_session.add(dept)
    await db_session.flush()

    admin = User(
        full_name="Admin",
        username="admin",
        password_hash=hash_password("admin12345"),
        role=UserRole.ADMIN,
        department_id=dept.id,
        is_active=True,
        is_approved=True,
    )
    chief = User(
        full_name="Chief",
        username="chief",
        password_hash=hash_password("chief12345"),
        role=UserRole.CHIEF,
        department_id=dept.id,
        is_active=True,
        is_approved=True,
    )
    employee = User(
        full_name="Employee",
        username="employee",
        password_hash=hash_password("employee12345"),
        role=UserRole.EMPLOYEE,
        department_id=dept.id,
        is_active=True,
        is_approved=True,
    )
    pending = User(
        full_name="Pending",
        username="pending",
        password_hash=hash_password("pending12345"),
        role=UserRole.EMPLOYEE,
        department_id=dept.id,
        is_active=True,
        is_approved=False,
    )
    db_session.add_all([admin, chief, employee, pending])
    await db_session.commit()
    return {"admin": admin, "chief": chief, "employee": employee, "pending": pending, "department": dept}


async def login(client: AsyncClient, username: str, password: str) -> None:
    response = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
