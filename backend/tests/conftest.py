from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import app
from app.models.acknowledgement import Acknowledgement
from app.models.approval_step import ApprovalStep
from app.models.audit_log import AuditLog
from app.models.department import Department
from app.models.document import Document
from app.models.document_file import DocumentFile
from app.models.enums import UserRole
from app.models.session import Session
from app.models.user import User


@pytest.fixture()
async def db_session() -> AsyncGenerator:
    async with SessionLocal() as session:
        await session.execute(delete(Acknowledgement))
        await session.execute(delete(ApprovalStep))
        await session.execute(delete(DocumentFile))
        await session.execute(delete(Document))
        await session.execute(delete(AuditLog))
        await session.execute(delete(Session))
        await session.execute(delete(User))
        await session.execute(delete(Department))
        await session.commit()
        yield session
        await session.execute(delete(Acknowledgement))
        await session.execute(delete(ApprovalStep))
        await session.execute(delete(DocumentFile))
        await session.execute(delete(Document))
        await session.execute(delete(AuditLog))
        await session.execute(delete(Session))
        await session.execute(delete(User))
        await session.execute(delete(Department))
        await session.commit()


@pytest.fixture()
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="https://testserver.local") as async_client:
        yield async_client


@pytest.fixture()
async def users_fixture(db_session):
    dept = Department(name="Тестовый отдел", is_active=True)
    second_dept = Department(name="Второй отдел", is_active=True)
    db_session.add(dept)
    db_session.add(second_dept)
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
    dept_head = User(
        full_name="Department Head",
        username="dept_head",
        password_hash=hash_password("depthead12345"),
        role=UserRole.DEPARTMENT_HEAD,
        department_id=dept.id,
        is_active=True,
        is_approved=True,
    )
    incoming_operator = User(
        full_name="Incoming Operator",
        username="incoming_op",
        password_hash=hash_password("incoming12345"),
        role=UserRole.INCOMING_DOC_OPERATOR,
        department_id=dept.id,
        is_active=True,
        is_approved=True,
    )
    personnel = User(
        full_name="Personnel",
        username="personnel",
        password_hash=hash_password("personnel12345"),
        role=UserRole.PERSONNEL_OFFICE,
        department_id=dept.id,
        is_active=True,
        is_approved=True,
    )
    unapproved = User(
        full_name="Unapproved",
        username="unapproved",
        password_hash=hash_password("unapproved12345"),
        role=UserRole.EMPLOYEE,
        department_id=dept.id,
        is_active=True,
        is_approved=False,
    )
    db_session.add_all([admin, chief, employee, dept_head, incoming_operator, personnel, unapproved])
    await db_session.commit()
    return {
        "admin": admin,
        "chief": chief,
        "employee": employee,
        "dept_head": dept_head,
        "incoming_operator": incoming_operator,
        "personnel": personnel,
        "unapproved": unapproved,
        "department": dept,
        "second_department": second_dept,
    }


async def login(client: AsyncClient, username: str, password: str) -> None:
    response = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
