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

    target_id = users_fixture["pending"].id
    response = await client.post(f"/api/v1/users/{target_id}/approve")
    assert response.status_code == 403


async def test_department_creation_access_restriction(client, users_fixture):
    await do_login(client, "employee", "employee12345")
    response = await client.post("/api/v1/departments", json={"name": "Новый отдел"})
    assert response.status_code == 403


async def test_audit_log_created_on_login(client, users_fixture, db_session):
    response = await client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin12345"})
    assert response.status_code == 200

    result = await db_session.execute(select(func.count(AuditLog.id)).where(AuditLog.action == "login.success"))
    count = result.scalar_one()
    assert count >= 1
