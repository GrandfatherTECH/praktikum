from sqlalchemy import func, select

from app.core.config import settings
from app.models.audit_log import AuditLog


async def do_login(client, username: str, password: str) -> None:
    response = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200


async def test_health_endpoint(client):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "timestamp" in data


async def test_login_success(client, users_fixture):
    response = await client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin12345"})
    assert response.status_code == 200
    assert response.cookies.get(settings.session_cookie_name)


async def test_login_failure(client, users_fixture):
    response = await client.post("/api/v1/auth/login", json={"username": "admin", "password": "wrong"})
    assert response.status_code == 401


async def test_me_with_valid_session(client, users_fixture):
    await do_login(client, "admin", "admin12345")
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 200
    assert response.json()["user"]["username"] == "admin"


async def test_me_without_session(client):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


async def test_user_approval_access_restriction(client, users_fixture):
    await do_login(client, "employee", "employee12345")

    target_id = users_fixture["unapproved"].id
    response = await client.post(f"/api/v1/users/{target_id}/approve")
    assert response.status_code == 403


async def test_department_creation_access_restriction(client, users_fixture):
    await do_login(client, "employee", "employee12345")
    response = await client.post("/api/v1/departments", json={"name": "Новый отдел"})
    assert response.status_code == 403


async def test_users_list_available_for_authenticated_employee(client, users_fixture):
    await do_login(client, "employee", "employee12345")
    response = await client.get("/api/v1/users")
    assert response.status_code == 200
    assert len(response.json()) >= 3


async def test_chief_can_edit_user_department(client, users_fixture):
    await do_login(client, "chief", "chief12345")
    response = await client.patch(
        f"/api/v1/users/{users_fixture['employee'].id}",
        json={"full_name": "Changed Name", "department_id": users_fixture["second_department"].id},
    )
    assert response.status_code == 200
    assert response.json()["department_id"] == users_fixture["second_department"].id


async def test_chief_can_approve_and_create_user(client, users_fixture):
    await do_login(client, "chief", "chief12345")
    approve_response = await client.post(f"/api/v1/users/{users_fixture['unapproved'].id}/approve")
    assert approve_response.status_code == 200

    create_response = await client.post(
        "/api/v1/users",
        json={
            "full_name": "New User",
            "username": "new_user",
            "password": "newuser12345",
            "role": "EMPLOYEE",
            "is_active": True,
        },
    )
    assert create_response.status_code == 201


async def test_admin_cannot_approve_user(client, users_fixture):
    await do_login(client, "admin", "admin12345")
    response = await client.post(f"/api/v1/users/{users_fixture['unapproved'].id}/approve")
    assert response.status_code == 403


async def test_audit_log_created_on_login(client, users_fixture, db_session):
    response = await client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin12345"})
    assert response.status_code == 200

    result = await db_session.execute(select(func.count(AuditLog.id)).where(AuditLog.action == "login.success"))
    count = result.scalar_one()
    assert count >= 1


async def test_admin_can_delete_user(client, users_fixture):
    await do_login(client, "admin", "admin12345")
    response = await client.delete(f"/api/v1/users/{users_fixture['employee'].id}")
    assert response.status_code == 200


async def test_admin_can_create_one_time_password_and_force_change(client, users_fixture):
    await do_login(client, "admin", "admin12345")
    response = await client.post(f"/api/v1/users/{users_fixture['employee'].id}/one-time-password")
    assert response.status_code == 200
    temporary_password = response.json()["temporary_password"]
    assert temporary_password

    client.cookies.clear()
    response = await client.post("/api/v1/auth/login", json={"username": "employee", "password": temporary_password})
    assert response.status_code == 200

    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 200
    assert response.json()["user"]["must_change_password"] is True


async def test_user_can_change_password_after_one_time_password(client, users_fixture):
    await do_login(client, "admin", "admin12345")
    response = await client.post(f"/api/v1/users/{users_fixture['employee'].id}/one-time-password")
    temporary_password = response.json()["temporary_password"]

    client.cookies.clear()
    response = await client.post("/api/v1/auth/login", json={"username": "employee", "password": temporary_password})
    assert response.status_code == 200

    response = await client.post(
        "/api/v1/auth/change-password",
        json={"current_password": temporary_password, "new_password": "employee67890"},
    )
    assert response.status_code == 200

    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401

    client.cookies.clear()
    response = await client.post("/api/v1/auth/login", json={"username": "employee", "password": "employee67890"})
    assert response.status_code == 200
