import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.department import Department
from app.models.enums import UserRole
from app.models.user import User


def _user_payloads(dept1_id: int, dept2_id: int) -> list[dict]:
    return [
        {
            "full_name": "Администратор",
            "username": "admin",
            "password": "admin12345",
            "role": UserRole.ADMIN,
            "department_id": dept1_id,
            "position": "Администратор системы",
            "is_approved": True,
        },
        {
            "full_name": "Руководитель",
            "username": "chief",
            "password": "chief12345",
            "role": UserRole.CHIEF,
            "department_id": dept1_id,
            "position": "Начальник",
            "is_approved": True,
        },
        {
            "full_name": "Начальник отдела",
            "username": "dept_head",
            "password": "depthead12345",
            "role": UserRole.DEPARTMENT_HEAD,
            "department_id": dept2_id,
            "position": "Начальник отдела",
            "is_approved": True,
        },
        {
            "full_name": "Сотрудник",
            "username": "employee",
            "password": "employee12345",
            "role": UserRole.EMPLOYEE,
            "department_id": dept2_id,
            "position": "Специалист",
            "is_approved": True,
        },
        {
            "full_name": "Оператор входящих",
            "username": "incoming_op",
            "password": "incoming12345",
            "role": UserRole.INCOMING_DOC_OPERATOR,
            "department_id": dept1_id,
            "position": "Оператор",
            "is_approved": True,
        },
        {
            "full_name": "Кадровая служба",
            "username": "personnel",
            "password": "personnel12345",
            "role": UserRole.PERSONNEL_OFFICE,
            "department_id": dept1_id,
            "position": "Кадровый специалист",
            "is_approved": True,
        },
    ]


async def seed() -> None:
    async with SessionLocal() as session:
        created_departments = 0
        created_users = 0

        result = await session.execute(select(Department).where(Department.name == "Администрация"))
        dept1 = result.scalar_one_or_none()
        if not dept1:
            dept1 = Department(name="Администрация", is_active=True)
            session.add(dept1)
            await session.flush()
            created_departments += 1

        result = await session.execute(select(Department).where(Department.name == "Отдел документооборота"))
        dept2 = result.scalar_one_or_none()
        if not dept2:
            dept2 = Department(name="Отдел документооборота", is_active=True)
            session.add(dept2)
            await session.flush()
            created_departments += 1

        for payload in _user_payloads(dept1.id, dept2.id):
            result = await session.execute(select(User).where(User.username == payload["username"]))
            user = result.scalar_one_or_none()
            if user:
                continue
            session.add(
                User(
                    full_name=payload["full_name"],
                    username=payload["username"],
                    password_hash=hash_password(payload["password"]),
                    role=payload["role"],
                    department_id=payload["department_id"],
                    position=payload["position"],
                    is_active=True,
                    is_approved=payload["is_approved"],
                )
            )
            created_users += 1

        result = await session.execute(select(User).where(User.username == settings.initial_admin_username))
        admin = result.scalar_one_or_none()
        if not admin:
            session.add(
                User(
                    full_name=settings.initial_admin_full_name,
                    username=settings.initial_admin_username,
                    password_hash=hash_password(settings.initial_admin_password),
                    role=UserRole.ADMIN,
                    is_active=True,
                    is_approved=True,
                )
            )
            created_users += 1

        await session.commit()
        print(
            f"Seed completed: departments_created={created_departments}, "
            f"users_created={created_users}"
        )


if __name__ == "__main__":
    asyncio.run(seed())
