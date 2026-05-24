# Deployment Notes (Phase 1 Placeholder)

## Target Architecture (Future Phases)

1. Backend runs in Docker.
2. PostgreSQL and Redis run in Docker on internal Docker network.
3. Frontend is built to static files and installed to `/var/www/sed/frontend`.
4. One external host-level Nginx serves frontend static files and proxies `/api/*` and `/api/v1/ws` to backend at `127.0.0.1:8000`.
5. GHCR will be used later for backend image only.

## Local Development Now

1. Start backend stack:
   `docker compose up --build`
2. Backend health:
   `curl http://127.0.0.1:8000/api/v1/health`
3. Frontend local dev:
   `cd frontend && npm install && npm run dev`

## Production Direction (Later)

1. Build frontend static bundle:
   `cd frontend && npm run build`
2. Copy `frontend/dist` to `/var/www/sed/frontend`.
3. Configure host-level Nginx from `deploy/nginx/sed-app.example.conf`.
4. Run backend/postgres/redis via production Compose with backend image from GHCR.
