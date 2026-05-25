# SED Phase 2 Backend Foundation

Phase 2 implements backend foundation only: async PostgreSQL ORM, Alembic schema, server-side session auth, users/departments management with RBAC, seed data, and audit logging.

Architecture remains unchanged:
- Docker Compose services: `backend`, `postgres`, `redis` only.
- No frontend container, no frontend Dockerfile.
- No Nginx container in this project.
- Frontend remains non-Dockerized.

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

## Frontend build (outside Docker)

```bash
cd frontend
npm run build
```

Deploy static files to `/var/www/sed/frontend` using `deploy/scripts/install-frontend.sh`.
