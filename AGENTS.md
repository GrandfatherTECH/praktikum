# AGENTS.md

# Project Instructions for Codex

You are building a secure local air-gapped document workflow system for a military-style organization.

Follow these instructions strictly. Do not invent a different architecture. Do not add unnecessary technologies. Do not convert this into microservices. Do not use cloud services. Do not use external APIs at runtime.

The application is a web-based document management and workflow system. It must run on a Linux server and be accessed from Windows client machines through a browser.

---

# 0. Absolute Architecture Decision

This project uses exactly one Nginx in production:

- the external host-level Nginx installed directly on the Linux server.

There must be no Nginx container.
There must be no frontend container.
There must be no backend-specific Nginx.
There must be no internal reverse proxy.
There must be no frontend Docker image.
There must be no frontend Dockerfile.

Docker Compose must run only these application/runtime services:

- backend
- postgres
- redis

React frontend is not a server in production.
React frontend is built into static files with:

```bash
npm run build
```

The build output is copied to:

```text
/var/www/sed/frontend
```

The external host-level Nginx serves those static files directly.

The external host-level Nginx also proxies API and WebSocket traffic to the backend container:

```text
/              -> /var/www/sed/frontend/index.html
/assets/*      -> /var/www/sed/frontend/assets/*
/api/*         -> http://127.0.0.1:8000/api/*
/api/v1/ws     -> http://127.0.0.1:8000/api/v1/ws
```

Backend must bind only to:

```text
127.0.0.1:8000
```

PostgreSQL and Redis must not expose ports to the host.

If you add any of the following, you are violating the architecture:

- `frontend/Dockerfile`
- frontend service in `docker-compose.yml`
- frontend service in `docker-compose.prod.yml`
- nginx service in any Compose file
- nginx image such as `nginx:alpine`
- Node/Vite dev server exposed in Docker Compose
- port `5173` in Docker Compose
- port `3000` for a frontend container
- `proxy_pass` from host Nginx to a frontend container
- serving protected storage directly from Nginx

Do not do any of that.

---

# 1. Core Architecture

Build a modular monolith.

Required runtime architecture:

```text
Windows client browser
        |
        | HTTPS / WSS
        v
External host-level Nginx installed on Linux server
        |
        | /api/* and /api/v1/ws
        v
FastAPI backend container bound to 127.0.0.1:8000
        |
        | SQL
        v
PostgreSQL container, internal Docker network only
        |
        | metadata, users, roles, workflow, audit
        v
Local protected file storage volume

Redis container is used for realtime WebSocket fanout.
Redis is internal Docker network only.
```

Required request model:

- HTTP REST is used for all mutations and data fetching.
- WebSocket is used only for realtime notifications/events.
- Do not upload files through WebSocket.
- Do not download files through WebSocket.
- After a WebSocket event, the frontend must refetch affected data via TanStack Query.

Correct flow example:

1. User approves document via HTTP POST.
2. Backend writes state change to PostgreSQL.
3. Backend writes audit log to PostgreSQL.
4. Backend publishes realtime event through Redis.
5. WebSocket connection sends event to relevant users.
6. Frontend invalidates/refetches TanStack Query cache.

---

# 2. Mandatory Stack

Use only this stack unless explicitly instructed otherwise.

## Backend

- Python
- FastAPI
- Uvicorn
- Gunicorn
- Pydantic v2
- SQLAlchemy 2.x async ORM
- asyncpg
- Alembic
- redis asyncio client
- argon2-cffi for password hashing
- python-multipart for uploads
- python-docx for DOCX generation
- LibreOffice headless for DOCX to PDF conversion
- pytest for backend tests
- ruff for linting/formatting

## Frontend

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- Ant Design
- PDF.js or a thin React wrapper around PDF.js
- ESLint
- Prettier

Important frontend rules:

- frontend is developed locally with Vite dev server;
- frontend is built into static files with `npm run build`;
- frontend is not Dockerized;
- frontend is not a production server;
- frontend has no Dockerfile;
- frontend has no Compose service;
- production Nginx serves static frontend files from `/var/www/sed/frontend`.

## Infrastructure

- PostgreSQL
- Redis
- external host-level Nginx installed on Linux server
- Docker Compose for backend/postgres/redis only
- local protected file storage volume
- GitHub Actions for backend image build/publish to GHCR
- GHCR for backend image only

## Allowed development-only additions

- pytest-asyncio if needed
- httpx for backend tests
- vitest if frontend tests are added

## Forbidden unless explicitly requested later

- Kubernetes
- Kafka
- RabbitMQ
- Celery
- ClamAV
- MinIO
- S3
- Keycloak
- OAuth provider
- LDAP / Active Directory
- Elasticsearch
- OpenSearch
- GraphQL
- Next.js
- SSR
- microservices
- external cloud storage
- external email services
- OCR
- electronic signature / EDS
- BPMN workflow engines
- document server suites
- AI features
- frontend Docker image
- frontend Dockerfile
- frontend container
- nginx container
- internal Nginx
- Vite dev server inside Docker Compose

If you think one of the forbidden technologies is useful, do not add it. Instead, document it in `docs/NEXT_STEPS.md`.

---

# 3. Development vs Production Frontend

## Local development

Frontend is run manually on the developer machine:

```bash
cd frontend
npm install
npm run dev
```

Vite may use port `5173` locally on the developer machine.

But port `5173` must never appear in Docker Compose.
Do not expose Vite through Docker Compose.
Do not create a frontend container for local development.

Backend, PostgreSQL and Redis are started with Docker Compose:

```bash
docker compose up --build
```

The frontend dev server talks to backend at:

```text
http://127.0.0.1:8000
```

## Production

Frontend is built into static files:

```bash
cd frontend
npm ci
npm run build
```

The result is copied to:

```text
/var/www/sed/frontend
```

Production frontend is served only by the external host-level Nginx.

There is no Node.js runtime for React in production.
There is no Vite server in production.
There is no frontend container in production.

---

# 4. Security Rules

This is an air-gapped/local system. Runtime must not depend on internet access.

Implement:

- login and logout;
- server-side sessions;
- session ID stored in HttpOnly cookie;
- SameSite cookie;
- Secure cookie configurable through environment variable;
- password hashing with Argon2;
- role-based access control;
- document participant-based access control;
- CSRF protection for unsafe cookie-authenticated requests;
- audit logging for all important actions;
- file upload validation;
- file download/preview access checks;
- safe file paths;
- protected files outside webroot;
- file metadata and SHA-256 hash in PostgreSQL;
- upload size limits in backend and external Nginx example config;
- no direct static serving of protected files;
- no path traversal;
- no arbitrary file execution;
- no trust in original filenames for storage paths.

Full order documents must not be freely downloadable.
Full order documents may be previewed in a protected PDF viewer after permission check.
Extracts from orders may be generated and downloaded after permission check.

Do not implement fake security comments. Implement actual checks in code.

---

# 5. User Roles

Implement these roles:

- ADMIN
- CHIEF
- DEPARTMENT_HEAD
- EMPLOYEE
- INCOMING_DOC_OPERATOR
- PERSONNEL_OFFICE

Rules:

- ADMIN manages users, departments, roles and system dictionaries.
- CHIEF sees all documents and incoming documents.
- CHIEF creates resolutions.
- CHIEF can approve new users.
- DEPARTMENT_HEAD sees documents related to their department.
- EMPLOYEE sees only documents assigned to them, created by them, or requiring their action.
- INCOMING_DOC_OPERATOR can upload incoming open-segment documents and submit them for chief resolution.
- PERSONNEL_OFFICE can register orders and manage order numbers/dates if this module is implemented.

Do not make all authenticated users see all documents.

---

# 6. Main Domain Concepts

Implement these core entities.

## User

Fields:

- id
- full_name
- username
- password_hash
- role
- department_id
- position
- is_active
- is_approved
- created_at
- updated_at

## Department

Fields:

- id
- name
- head_user_id nullable
- is_active
- created_at
- updated_at

## Document

Generic document entity.

Types:

- ORDER
- INSTRUCTION
- INCOMING_LETTER
- RESOLUTION
- ORDER_EXTRACT

Fields:

- id
- type
- title
- body_text
- author_id
- department_id
- status
- current_version
- created_at
- updated_at
- registered_number nullable
- registered_date nullable
- metadata jsonb if needed

## DocumentFile

Fields:

- id
- document_id
- version
- original_filename
- storage_path
- mime_type
- size_bytes
- sha256
- kind: ORIGINAL_DOCX / RENDERED_PDF / SCAN / EXTRACT_DOCX / EXTRACT_PDF
- is_download_allowed
- created_by
- created_at

## ApprovalStep

Sequential approval route.

Fields:

- id
- document_id
- step_order
- approver_id
- status: PENDING / WAITING / APPROVED / RETURNED / SKIPPED
- comment nullable
- acted_at nullable

Rules:

- Approval is strictly sequential.
- Only the current WAITING approver can approve or return.
- If a document is returned for revision, later approvers must not receive it.
- When resubmitted, keep the same approval order.
- Record all actions in audit log.

## Acknowledgement

For ознакомление.

Fields:

- id
- document_id
- user_id
- status: PENDING / ACKNOWLEDGED
- acknowledged_at nullable

Rules:

- Acknowledgement does not allow edits.
- It happens after approval for ORDER.
- It can happen directly for INSTRUCTION.

## IncomingLetter

Can be represented either as Document type INCOMING_LETTER or a separate table linked to Document. Prefer simple design unless separation is clearly cleaner.

Must support:

- uploaded scan/file;
- sender;
- received_at;
- status;
- linked resolution.

## Resolution

Can be represented as Document type RESOLUTION linked to incoming letter.

Must support:

- linked incoming letter;
- text;
- assigned users;
- assigned departments;
- status;
- created by CHIEF.

## AuditLog

Fields:

- id
- actor_id nullable
- action
- entity_type
- entity_id
- before jsonb nullable
- after jsonb nullable
- ip_address nullable
- user_agent nullable
- created_at

Audit these actions at minimum:

- login success/failure
- logout
- create document
- update document
- upload file
- send for approval
- approve
- return for revision
- resubmit
- send for acknowledgement
- acknowledge
- create resolution
- assign resolution
- register order
- generate extract
- download allowed file
- preview protected file
- user creation
- user approval
- role change

---

# 7. Document Statuses

Use explicit enums.

## ORDER statuses

- DRAFT
- ON_APPROVAL
- REVISION_REQUIRED
- APPROVED
- ON_ACKNOWLEDGEMENT
- ACKNOWLEDGEMENT_COMPLETED
- REGISTERED
- ARCHIVED

## INSTRUCTION statuses

- DRAFT
- SENT
- ACKNOWLEDGED
- IN_PROGRESS
- COMPLETED
- ARCHIVED

## INCOMING_LETTER statuses

- UPLOADED
- WAITING_RESOLUTION
- RESOLUTION_CREATED
- IN_PROGRESS
- CLOSED
- ARCHIVED

## RESOLUTION statuses

- CREATED
- SENT
- RECEIVED
- IN_PROGRESS
- COMPLETED
- CLOSED

Do not replace these with free-text statuses.

---

# 8. Backend API Requirements

Implement API with `/api/v1`.

Minimum endpoints:

## Health

- GET `/api/v1/health`

## Auth

- POST `/api/v1/auth/login`
- POST `/api/v1/auth/logout`
- GET `/api/v1/auth/me`

## Users

- GET `/api/v1/users`
- POST `/api/v1/users`
- POST `/api/v1/users/{id}/approve`
- PATCH `/api/v1/users/{id}`
- GET `/api/v1/users/me/tasks`

## Departments

- GET `/api/v1/departments`
- POST `/api/v1/departments`
- PATCH `/api/v1/departments/{id}`

## Documents

- GET `/api/v1/documents`
- POST `/api/v1/documents`
- GET `/api/v1/documents/{id}`
- PATCH `/api/v1/documents/{id}`
- POST `/api/v1/documents/{id}/files`
- GET `/api/v1/documents/{id}/preview`
- POST `/api/v1/documents/{id}/send-for-approval`
- POST `/api/v1/documents/{id}/approve`
- POST `/api/v1/documents/{id}/return-for-revision`
- POST `/api/v1/documents/{id}/resubmit`
- POST `/api/v1/documents/{id}/send-for-acknowledgement`
- POST `/api/v1/documents/{id}/acknowledge`
- POST `/api/v1/documents/{id}/generate-extract`

## Incoming

- POST `/api/v1/incoming`
- GET `/api/v1/incoming`
- GET `/api/v1/incoming/{id}`
- POST `/api/v1/incoming/{id}/resolution`

## Realtime

- WebSocket `/api/v1/ws`

## Admin/Audit

- GET `/api/v1/audit`

Do not expose raw filesystem paths in API responses.

---

# 9. WebSocket Requirements

Implement WebSocket with session authentication.

Events must be structured:

```json
{
  "type": "document.updated",
  "entity_id": 123,
  "payload": {
    "status": "ON_APPROVAL"
  },
  "created_at": "ISO-8601 timestamp"
}
```

Required event types:

- document.created
- document.updated
- document.sent_for_approval
- document.approved
- document.returned_for_revision
- document.resubmitted
- document.sent_for_acknowledgement
- document.acknowledged
- incoming.uploaded
- resolution.created
- resolution.assigned
- user.approved

Redis Pub/Sub must be used so realtime works with multiple Gunicorn/Uvicorn worker processes.

WebSocket must not be the source of truth.
PostgreSQL is the source of truth.

---

# 10. File Handling

Rules:

- Upload through HTTP multipart only.
- Store files in local protected storage volume.
- Store metadata in PostgreSQL.
- Compute SHA-256 for each file.
- Allow only configured file extensions:
  - .docx
  - .pdf
  - .png
  - .jpg
  - .jpeg
- Reject unknown MIME types.
- Reject oversized files.
- Full ORDER file must not be downloadable unless role and policy explicitly allow it.
- Preview should stream generated/protected PDF after permission check.
- Extract files may be downloadable after permission check.

Storage structure example:

```text
/storage/documents/{year}/{month}/{document_id}/{version}/{file_id}.bin
/storage/extracts/{year}/{month}/{document_id}/{file_id}.bin
/storage/incoming/{year}/{month}/{document_id}/{file_id}.bin
```

Do not use original filename as storage filename.
Do not serve `/storage` with Nginx.
Do not put protected files into `frontend/public`.
Do not put protected files into `/var/www/sed/frontend`.

---

# 11. DOCX/PDF Generation

Implement minimal working generation:

- Generate DOCX for ORDER and INSTRUCTION using python-docx.
- Convert DOCX to PDF using LibreOffice headless.
- Store generated PDF as DocumentFile kind RENDERED_PDF.
- Use simple templates for now.
- Put template-related code in a dedicated backend service/module.

Do not implement complex template designer.

---

# 12. Frontend Requirements

Build React + TypeScript + Vite frontend.

Use Ant Design components.

Required pages:

- Login page
- Main layout with sidebar
- Dashboard
- New documents
- Current documents
- Created by me
- Archive
- Incoming documents
- Resolutions
- Document detail
- Create document
- Create incoming letter
- Create resolution
- Users admin
- Departments admin
- Audit log

Use React Router for routes.
Use TanStack Query for all HTTP data.
Use WebSocket client for realtime events.

When WebSocket event is received:

- show notification if relevant;
- invalidate affected queries;
- do not mutate complex state manually unless trivial.

Do not use Redux.
Do not use Next.js.
Do not build a custom UI library.
Do not create frontend Dockerfile.
Do not create frontend container.
Do not expose frontend ports in Compose.

---

# 13. UX Rules

Keep UI functional and boring.

Prioritize:

- tables;
- filters;
- statuses;
- forms;
- clear action buttons;
- role-based visibility;
- document preview;
- audit visibility.

Do not waste time on fancy animations.

Use Russian labels in UI.

Minimum Russian terms:

- Вход
- Документы
- Новые
- Текущие
- Созданные мной
- Архив
- Входящая документация
- Резолюции
- Пользователи
- Отделы
- Журнал действий
- Согласовать
- Вернуть на доработку
- Ознакомлен
- Взять в работу
- Создать приказ
- Создать приказание
- Создать резолюцию
- Сформировать выписку

---

# 14. Repository Structure

Use this structure:

```text
.
├── backend
│   ├── app
│   │   ├── api
│   │   ├── core
│   │   ├── db
│   │   ├── models
│   │   ├── schemas
│   │   ├── services
│   │   ├── realtime
│   │   ├── storage
│   │   └── main.py
│   ├── alembic
│   ├── tests
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend
│   ├── src
│   │   ├── api
│   │   ├── app
│   │   ├── components
│   │   ├── pages
│   │   ├── routes
│   │   ├── websocket
│   │   └── main.tsx
│   ├── package.json
│   ├── package-lock.json
│   ├── index.html
│   └── vite.config.ts
├── deploy
│   ├── nginx
│   │   └── sed-app.example.conf
│   └── scripts
│       ├── deploy.sh
│       ├── build-frontend.sh
│       ├── install-frontend.sh
│       ├── offline-save.sh
│       └── offline-load.sh
├── storage
│   └── .gitkeep
├── docs
│   ├── ARCHITECTURE.md
│   ├── ASSUMPTIONS.md
│   ├── DEPLOYMENT.md
│   ├── IMPLEMENTATION_STATUS.md
│   └── NEXT_STEPS.md
├── .github
│   └── workflows
│       └── docker-publish.yml
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── AGENTS.md
└── README.md
```

Forbidden files/dirs:

```text
frontend/Dockerfile
nginx/nginx.conf
```

Do not create them.

---

# 15. Docker Compose Requirements

Docker Compose must run only:

- backend
- postgres
- redis

No other runtime services.

Do not add:

- frontend service;
- nginx service;
- worker service unless explicitly requested later;
- Celery;
- ClamAV;
- MinIO;
- mail service.

## Local docker-compose.yml

Local Compose is for backend infrastructure only.

Required:

- backend builds from `./backend`;
- backend binds to `127.0.0.1:8000:8000`;
- postgres is internal only;
- redis is internal only;
- storage volume is mounted into backend;
- no frontend container;
- no nginx container;
- no `5173` port;
- no `3000` port for frontend.

Example shape:

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "127.0.0.1:8000:8000"
    depends_on:
      - postgres
      - redis
    env_file:
      - .env
    volumes:
      - ./storage:/app/storage

  postgres:
    image: postgres:16
    env_file:
      - .env
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7

volumes:
  postgres_data:
```

Do not expose PostgreSQL host port.
Do not expose Redis host port.

## Production docker-compose.prod.yml

Production Compose must run:

- backend from GHCR image;
- postgres;
- redis.

Production Compose must not include frontend service.
Production Compose must not include nginx service.

Backend image:

```text
ghcr.io/<OWNER>/<REPO>-backend:<tag>
```

Allowed host binding:

```text
backend: 127.0.0.1:8000
```

PostgreSQL and Redis must be available only inside Docker network.

Protected storage must be mounted as a volume and must never be served directly by Nginx.

---

# 16. External Host Nginx

Production must support an externally managed host-level Nginx.

The project must provide an example config only:

```text
deploy/nginx/sed-app.example.conf
```

Do not add Nginx to Docker Compose.
Do not create an `nginx` directory in project root.
Do not create an internal Nginx config for containers.

The example config must show how to:

- serve frontend static files from `/var/www/sed/frontend`;
- proxy `/api/` to `http://127.0.0.1:8000/api/`;
- proxy `/api/v1/ws` to `http://127.0.0.1:8000/api/v1/ws`;
- set `client_max_body_size`;
- pass `X-Real-IP`;
- pass `X-Forwarded-For`;
- pass `X-Forwarded-Proto`;
- configure TLS certificate paths in comments;
- avoid serving protected storage directly.

Required WebSocket proxy headers:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

Nginx must not expose:

- PostgreSQL;
- Redis;
- local protected file storage.

---

# 17. GHCR and GitHub Actions

Use GHCR for the backend image only.

Do not publish a frontend Docker image.
Do not build a frontend Docker image.
Do not create a frontend Dockerfile.

Required backend image:

```text
ghcr.io/<OWNER>/<REPO>-backend:<tag>
```

Tags:

```text
latest
<commit-sha>
```

The workflow must:

- run on push to `main`;
- build backend image;
- push backend image to `ghcr.io`;
- tag backend image with both `latest` and commit SHA;
- use `GITHUB_TOKEN` for publishing packages;
- not hardcode secrets.

Frontend deployment in GitHub Actions:

- The workflow may run `npm ci` and `npm run build` for validation.
- The workflow may upload `frontend/dist` as a build artifact.
- The workflow must not build a frontend Docker image.
- The workflow must not publish a frontend image to GHCR.

Default GitHub Actions workflow must only build/publish backend and optionally validate frontend build.

Optional SSH deployment may be documented, but do not make it mandatory.

If SSH deployment is implemented later, use GitHub Secrets:

```text
DEPLOY_HOST
DEPLOY_USER
DEPLOY_SSH_KEY
```

Do not hardcode server IP, usernames, passwords, private keys or tokens.

---

# 18. Server Deployment Scripts

Add:

```text
deploy/scripts/deploy.sh
deploy/scripts/build-frontend.sh
deploy/scripts/install-frontend.sh
```

## deploy.sh

The script must:

1. enter the app directory;
2. pull latest backend GHCR image;
3. run Alembic migrations;
4. restart backend/postgres/redis containers;
5. remove orphan containers;
6. optionally prune old images.

Expected logic:

```bash
docker compose -f docker-compose.prod.yml pull backend
docker compose -f docker-compose.prod.yml run --rm backend alembic upgrade head
docker compose -f docker-compose.prod.yml up -d --remove-orphans
docker image prune -f
```

The script must use:

```bash
set -euo pipefail
```

Do not put secrets in scripts.

## build-frontend.sh

The script may build frontend static files:

```bash
cd frontend
npm ci
npm run build
```

It must not start a frontend server.
It must not start Vite in production.
It must not use Docker.

## install-frontend.sh

The script may copy frontend build output to:

```text
/var/www/sed/frontend
```

It must copy static files only.
It must not copy source code as served files.
It must not copy protected storage.

---

# 19. Airgap Deployment

Document clearly:

Direct auto-deploy from GitHub/GHCR is impossible in a fully air-gapped production environment.

For airgap production, provide offline image transfer scripts.

Required scripts:

```text
deploy/scripts/offline-save.sh
deploy/scripts/offline-load.sh
```

`offline-save.sh` must:

- pull required backend GHCR image;
- pull required base runtime images if needed;
- export them with `docker save`;
- create a `.tar` archive suitable for offline transfer.

`offline-load.sh` must:

- load images with `docker load`;
- start or update containers with `docker compose -f docker-compose.prod.yml up -d`;
- not require internet access.

Frontend in airgap:

- build frontend on an internet-connected/dev machine or CI;
- transfer static `dist` files separately;
- install them into `/var/www/sed/frontend`;
- do not use a frontend image.

Document the offline flow in:

```text
docs/DEPLOYMENT.md
```

Offline flow:

```text
1. Build backend image in GitHub Actions.
2. Pull backend image on internet-connected machine.
3. Run offline-save.sh.
4. Build frontend static files.
5. Transfer backend image archive and frontend static files to air-gapped server.
6. Run offline-load.sh.
7. Install frontend static files into /var/www/sed/frontend.
8. Run migrations.
9. Start containers.
10. Reload external host Nginx.
```

---

# 20. Deployment Documentation

Add:

```text
docs/DEPLOYMENT.md
```

It must explain:

- local development deployment;
- backend/PostgreSQL/Redis Docker Compose startup;
- frontend local Vite development;
- frontend production static build;
- staging deployment with GHCR backend image;
- production deployment with external host Nginx;
- how to configure `.env`;
- how to login to GHCR on server;
- how to run `deploy.sh`;
- how to build and install frontend static files;
- how to configure host Nginx;
- how to reload Nginx;
- how to perform offline airgap deployment;
- how to rollback to previous commit SHA backend image.

Rollback must be based on commit SHA tags, not only `latest`.

Example:

```bash
BACKEND_IMAGE=ghcr.io/<OWNER>/<REPO>-backend:<old-sha>
docker compose -f docker-compose.prod.yml up -d
```

Do not rely only on `latest` for production rollback.

---

# 21. Database Requirements

Use Alembic migrations.

Do not create tables ad hoc at runtime except in tests.

Use PostgreSQL enums or safe string enums consistently.

Add indexes for:

- document type;
- document status;
- document author;
- document department;
- approval approver/status;
- acknowledgement user/status;
- audit entity;
- created_at fields where useful.

---

# 22. Seed Data

Provide safe development seed command.

Seed:

- admin user;
- chief user;
- department head user;
- employee user;
- incoming operator user;
- personnel office user;
- at least two departments.

Credentials must be documented only for local development in README.

Production must require changing secrets/passwords.

---

# 23. Testing Requirements

Implement meaningful tests, not fake tests.

Backend tests minimum:

- login success/failure;
- role access restriction;
- create document;
- send order for approval;
- sequential approval rule;
- return for revision;
- acknowledgement;
- file upload validation;
- audit log creation.

Frontend tests are optional for MVP, but TypeScript build must pass.

Required commands must work when related functionality is implemented:

```bash
docker compose up --build
docker compose exec backend alembic upgrade head
docker compose exec backend pytest
docker compose exec backend ruff check .
cd frontend && npm run build
```

If exact container names differ, document correct commands.

---

# 24. MVP Scope

Implement the first working MVP, not the whole future system.

MVP must include:

- authentication;
- roles;
- departments;
- user approval;
- document CRUD;
- order creation;
- instruction creation;
- incoming letter upload;
- resolution creation;
- sequential approval flow;
- return for revision with comment;
- acknowledgement flow;
- protected file upload;
- protected PDF preview endpoint;
- extract generation stub or basic implementation;
- WebSocket realtime events via Redis;
- audit log;
- Docker Compose for backend/postgres/redis;
- external host Nginx example config;
- README.

MVP may simplify:

- DOCX template layout;
- PDF visual design;
- extract formatting;
- personnel office module;
- advanced filters.

MVP must not include:

- OCR;
- electronic signature;
- antivirus;
- external mail integration;
- complex template designer;
- complex reporting;
- LDAP/AD;
- cloud services;
- frontend Docker image;
- frontend container;
- Nginx container.

---

# 25. Phase 1 Strict Scope

For the initial project skeleton, implement only this:

1. Create backend FastAPI app.
2. Create frontend React + TypeScript + Vite app.
3. Create Docker Compose with only backend, postgres and redis.
4. Backend exposes `/api/v1/health`.
5. Backend binds to `127.0.0.1:8000`.
6. PostgreSQL and Redis do not expose host ports.
7. Create external host Nginx example config at `deploy/nginx/sed-app.example.conf`.
8. Create `.env.example`.
9. Create `README.md` with local startup commands.
10. Create `docs/ASSUMPTIONS.md`.
11. Create `docs/IMPLEMENTATION_STATUS.md`.
12. Create `docs/DEPLOYMENT.md` with placeholder deployment notes.

Do not implement full document workflow in Phase 1.
Do not add GitHub Actions in Phase 1 unless explicitly requested.
Do not add production deployment scripts in Phase 1 unless explicitly requested.
Do not add frontend Dockerfile.
Do not add frontend container.
Do not add Nginx container.
Do not expose frontend port in Docker Compose.

Required result for Phase 1:

```bash
docker compose up --build
```

Backend health endpoint works:

```text
http://127.0.0.1:8000/api/v1/health
```

Frontend can run separately in local development:

```bash
cd frontend
npm install
npm run dev
```

Frontend is not part of Docker Compose.

---

# 26. Implementation Rules

Do not ask broad clarification questions.

If something is ambiguous:

1. Make a reasonable conservative assumption.
2. Document it in `docs/ASSUMPTIONS.md`.
3. Continue implementation.

Do not silently change the stack.
Do not add libraries unless they are required for the mandatory stack or tests.
Before adding any dependency, check whether the same can be done with the existing stack.

Do not create placeholder-only code for core flows.
Core flows must work.

Do not leave TODOs inside security-critical code.
Do not implement fake auth.
Do not implement fake permissions.
Do not implement fake audit.
Do not implement fake WebSocket events.
Do not make all pages static mockups.
Frontend must call backend API.

Do not store protected files in `frontend/public`.
Do not expose storage directory through Nginx.
Do not put secrets in git.

---

# 27. Hard Failure Conditions

If your solution contains any of the following, it is wrong and must be fixed:

- `frontend/Dockerfile`
- frontend service in `docker-compose.yml`
- frontend service in `docker-compose.prod.yml`
- nginx service in any Compose file
- `nginx:alpine` image
- port `5173` in Docker Compose
- port `3000` for frontend in Docker Compose
- protected storage served by Nginx
- PostgreSQL port exposed to host
- Redis port exposed to host
- WebSocket used for file transfer
- frontend Docker image in GHCR
- frontend container in production
- Vite dev server in production

When in doubt, choose the simpler architecture:

```text
External host Nginx + backend container + postgres container + redis container + static React files
```

---

# 28. Completion Criteria

Work is done only when:

- `docker compose up --build` starts backend, postgres and redis;
- no frontend container exists;
- no Nginx container exists;
- backend connects to PostgreSQL;
- backend connects to Redis;
- backend health endpoint works;
- frontend can run locally with `npm run dev`;
- frontend can build with `npm run build`;
- external host Nginx example config exists;
- Nginx example config serves `/var/www/sed/frontend`;
- Nginx example config proxies `/api/` to `127.0.0.1:8000`;
- Nginx example config proxies `/api/v1/ws` with WebSocket headers;
- README explains local backend startup;
- README explains local frontend startup;
- README explains that frontend is not Dockerized;
- `docs/IMPLEMENTATION_STATUS.md` describes what is implemented and what remains.

For later MVP completion, also ensure:

- Alembic migrations apply;
- user can log in;
- user sees role-appropriate documents;
- user can create an order;
- user can send order for approval;
- correct approver receives it;
- approver can approve or return for revision;
- later approvers do not receive document before earlier approval;
- user can create instruction;
- assigned users receive instruction;
- user can acknowledge instruction;
- incoming operator can upload incoming letter;
- chief can create resolution;
- assigned users receive resolution;
- WebSocket event updates frontend notification/query;
- audit log records key actions;
- protected file preview works with permission check.

---

# 29. Final Response Format

When finished, respond with:

1. Summary of implemented features.
2. List of changed/created files.
3. Commands run and their result.
4. Any assumptions made.
5. Known limitations.
6. Next recommended tasks.

Do not provide long architecture essays in the final response unless implementation failed.

---

# 30. Recommended First Prompt

Use this prompt for the first Codex run:

```text
Create the initial project skeleton according to AGENTS.md.

Do only Phase 1:
1. Create backend FastAPI app.
2. Create frontend React + TypeScript + Vite app.
3. Create Docker Compose with exactly three services only: backend, postgres, redis.
4. Do not create frontend Dockerfile.
5. Do not create frontend container.
6. Do not create Nginx container.
7. Do not expose port 5173 in Docker Compose.
8. Do not expose PostgreSQL or Redis ports to the host.
9. Backend must bind to 127.0.0.1:8000.
10. Backend must provide /api/v1/health.
11. Frontend must run separately with npm run dev during local development.
12. Frontend must build static files with npm run build.
13. Create external host Nginx example config at deploy/nginx/sed-app.example.conf.
14. The Nginx example must serve /var/www/sed/frontend and proxy /api/ and /api/v1/ws to 127.0.0.1:8000.
15. Create .env.example.
16. Create README.md with local startup commands.
17. Create docs/ASSUMPTIONS.md and docs/IMPLEMENTATION_STATUS.md.

Do not implement the full document workflow yet.
Do not add GitHub Actions yet.
Do not add production deploy scripts yet.
Do not add optional technologies.

The only required working result now:
- docker compose up --build starts backend, postgres and redis;
- backend health endpoint works;
- frontend can run separately with npm run dev;
- frontend can build with npm run build.
```

---

# 31. Correction Prompt If Codex Violates Architecture

If Codex adds frontend Docker, frontend container, Nginx container, or exposes port 5173 in Compose, use this:

```text
Stop. You violated AGENTS.md.

Remove immediately:
- frontend Dockerfile;
- frontend service from Docker Compose;
- Nginx service from Docker Compose;
- any nginx container;
- any frontend image;
- any port 5173 or 3000 exposed in Docker Compose.

The correct architecture is:
- Docker Compose runs only backend, postgres and redis.
- Backend binds to 127.0.0.1:8000.
- PostgreSQL and Redis are internal only.
- React frontend is not Dockerized.
- React frontend runs locally with npm run dev in development.
- React frontend builds static files with npm run build.
- External host-level Nginx serves /var/www/sed/frontend and proxies /api/ plus /api/v1/ws to backend.

Fix the repository to match AGENTS.md exactly.
Update docs/IMPLEMENTATION_STATUS.md with what you changed.
```
