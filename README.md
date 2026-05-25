# SED Phase 1 Skeleton

Phase 1 keeps the system intentionally minimal: FastAPI backend, React frontend, and Docker Compose with only `backend`, `postgres`, and `redis`.

## Local startup

1. Copy `.env.example` to `.env` and adjust credentials if needed.
2. Start backend infrastructure:

```bash
docker compose up --build -d
```

3. Check backend health:

```bash
curl http://127.0.0.1:8000/api/v1/health
```

Expected response:

```json
{"status":"ok"}
```

## Frontend development

Frontend runs outside Docker:

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8000`.

## Frontend production build

```bash
cd frontend
npm run build
```

Install static files by copying `frontend/dist` to `/var/www/sed/frontend`.

## Production deployment

Production Compose uses only `backend`, `postgres`, and `redis`:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Recommended rollout script:

```bash
./deploy/scripts/deploy.sh
```

## Important notes

1. `frontend` is not Dockerized and is never started via Compose.
2. There is no Nginx container; only the host-level Nginx is supported.
3. PostgreSQL data is stored in a named Docker volume `sed_postgres_data` mounted at `/var/lib/postgresql`, which is the correct layout for `postgres:18+`.
4. Backend is published only on `127.0.0.1:8000` at the host level.
5. Do not use `docker compose down -v` on environments where database data must be preserved.
6. If you upgrade an existing volume from `postgres:16/17` to `postgres:18`, you must either migrate the data with `pg_upgrade` or remove the old volume for a clean dev reset.
