#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$ROOT_DIR"

set -a
source .env
set +a

docker compose -f docker-compose.prod.yml pull backend
docker compose -f docker-compose.prod.yml up -d postgres redis

until docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  sleep 2
done

docker compose -f docker-compose.prod.yml run --no-deps --rm backend alembic upgrade head
docker compose -f docker-compose.prod.yml up -d --remove-orphans backend
docker image prune -f
