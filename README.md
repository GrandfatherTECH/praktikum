# SED Phase 3A Frontend Foundation

Phase 3A adds the first real frontend layer on top of the existing backend foundation: React + TypeScript + Vite, session-based authentication UI, protected routing, dashboard, and admin pages for users and departments.

Architecture remains unchanged:
- Docker Compose services: `backend`, `postgres`, `redis` only.
- No frontend container, no frontend Dockerfile.
- No Nginx container in this project.
- Frontend remains non-Dockerized.
- Frontend calls backend through relative `/api/v1` paths and Vite dev proxy in local development.

## Run backend stack

```bash
docker compose up --build -d
```

## Run migrations

```bash
docker compose exec backend alembic upgrade head
```

## Seed development data

```bash
docker compose exec backend python -m app.seed.seed_data
```

## Development credentials (local only)

Change all passwords in production.

- `admin` / `admin12345`
- `chief` / `chief12345`
- `dept_head` / `depthead12345`
- `employee` / `employee12345`
- `incoming_op` / `incoming12345`
- `personnel` / `personnel12345`

Login flow:
- open `http://127.0.0.1:5173`
- sign in with one of the seeded accounts above
- session is stored in HttpOnly cookie by the backend
- protected routes redirect to `/login` when session is missing or expired

## Health check

```bash
curl http://127.0.0.1:8000/api/v1/health
```

## Run backend tests

```bash
docker compose exec backend pytest
```

## Frontend development (outside Docker)

```bash
cd frontend
npm install
npm run dev
```

Vite runs locally on `127.0.0.1:5173` and proxies `/api` to `http://127.0.0.1:8000`.
Do not add the frontend to Docker Compose.

## Frontend build (outside Docker)

```bash
cd frontend
npm run build
```

Deploy static files to `/var/www/sed/frontend` using `deploy/scripts/install-frontend.sh`.

## Implemented UI in Phase 3A

- Login page with backend session auth integration.
- Authenticated layout with sidebar, top bar, current user, and logout.
- Dashboard with current user info and temporary status cards.
- Users admin page:
  - user list
  - create user
  - edit user
  - approve user
- Departments page:
  - department list
  - create department
  - edit department
- Placeholder sections for documents, incoming documents, resolutions, archive, and audit log.
