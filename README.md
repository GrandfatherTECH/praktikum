# SED Phase 1 Skeleton

Phase 1 provides the initial project skeleton only.

## Architecture Constraints

1. Docker Compose runs exactly 3 services: `backend`, `postgres`, `redis`.
2. Frontend is not Dockerized.
3. Nginx is external host-level only (example config in `deploy/nginx/sed-app.example.conf`).

## Local Backend Startup

```bash
docker compose up --build
```

Backend health endpoint:

```bash
curl http://127.0.0.1:8000/api/v1/health
```

Expected response:

```json
{"status":"ok"}
```

## Local Frontend Startup

Run frontend separately from Docker:

```bash
cd frontend
npm install
npm run dev
```

The frontend uses Vite proxy for `/api` to `http://127.0.0.1:8000`.

## Frontend Production Build

```bash
cd frontend
npm run build
```

Deploy static files by copying `frontend/dist` to:

```text
/var/www/sed/frontend
```

## Important Notes

1. No `frontend` service exists in Docker Compose.
2. No Nginx container exists in Docker Compose.
3. PostgreSQL and Redis are internal-only (no host ports exposed).
