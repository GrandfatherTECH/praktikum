# Implementation Status (Phase 1)

## Implemented

1. Project skeleton with required directories/files for backend, frontend, deploy, docs, and storage.
2. FastAPI backend with `GET /api/v1/health` returning `{ "status": "ok" }`.
3. Backend configuration placeholders for PostgreSQL and Redis via environment variables.
4. Backend Dockerfile with Uvicorn startup.
5. `docker-compose.yml` with exactly three services: `backend`, `postgres`, `redis`.
6. Backend published only on `127.0.0.1:8000:8000`.
7. PostgreSQL and Redis configured without host port exposure.
8. Frontend created as React + TypeScript + Vite project (non-Dockerized).
9. Frontend contains a minimal Russian UI and health-check call to `/api/v1/health`.
10. External host-level Nginx example created at `deploy/nginx/sed-app.example.conf`.
11. Documentation for local startup and deployment approach.

## Not Implemented (Intentionally Out of Phase 1 Scope)

1. Authentication and session handling.
2. Roles, users, departments, and approvals.
3. Document domain models and workflows.
4. WebSocket runtime logic and Redis pub/sub integration.
5. Alembic migrations and database schema.
6. File upload/download/preview security flows.
7. DOCX/PDF generation.
8. GitHub Actions CI/CD.
9. Production deployment scripts.
