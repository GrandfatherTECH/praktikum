# Assumptions

1. Phase 1 is intentionally minimal and only includes infrastructure skeleton plus health endpoint.
2. A local `.env` file is used by Docker Compose; `.env.example` is copied to `.env` for quick start.
3. Backend reads PostgreSQL/Redis settings from environment variables but does not connect to them yet.
4. Frontend local development uses Vite proxy from `/api` to `http://127.0.0.1:8000`.
5. Host-level Nginx is managed outside this repository and represented only by an example config.
