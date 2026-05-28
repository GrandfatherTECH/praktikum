# SED Phase 4

Phase 4 adds a structured official document builder on top of the existing auth/admin foundation.

Architecture remains unchanged:
- Docker Compose services: `backend`, `postgres`, `redis` only.
- No frontend container, no frontend Dockerfile.
- No Nginx container in this repository.
- Frontend remains non-Dockerized.
- Static frontend build is still served by external shared Nginx from `/var/www/sed/frontend`.

## Implemented in this phase

- Structured ORDER and INSTRUCTION creation forms in the frontend.
- Structured document storage in PostgreSQL with `structured_data` JSONB.
- Server-side DOCX generation with `python-docx`.
- Server-side PDF generation through LibreOffice headless.
- Protected PDF preview through backend endpoint.
- Sequential approval route for ORDER.
- Acknowledgement list and acknowledgement flow.
- ORDER extract generation with downloadable extract files.
- Incoming letter and resolution vertical slice.
- Audit log API and frontend page.

## Backend stack startup

```bash
docker compose up --build
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.seed.seed_data
```

Health check:

```bash
curl http://127.0.0.1:8000/api/v1/health
```

## Frontend development

```bash
cd frontend
npm install
npm run dev
```

Frontend stays outside Docker and talks to the backend through the local Vite proxy.

## Frontend build

```bash
cd frontend
npm run build
```

## Backend tests

```bash
docker compose exec backend pytest
```

## Development credentials

Change all passwords in production.

- `admin` / `admin12345`
- `chief` / `chief12345`
- `dept_head` / `depthead12345`
- `employee` / `employee12345`
- `incoming_op` / `incoming12345`
- `personnel` / `personnel12345`

## How document generation works

1. The user fills structured fields in the browser.
2. The backend stores metadata in `documents` and structured payload in `structured_data`.
3. `python-docx` generates protected DOCX files under `/app/storage`.
4. LibreOffice headless converts the generated DOCX to PDF.
5. The browser preview uses `GET /api/v1/documents/{id}/preview`.

Storage layout:
- `/app/storage/documents/{year}/{month}/{document_id}/{version}/generated.docx`
- `/app/storage/documents/{year}/{month}/{document_id}/{version}/generated.pdf`
- `/app/storage/extracts/{year}/{month}/{document_id}/generated.docx`
- `/app/storage/extracts/{year}/{month}/{document_id}/generated.pdf`

## Download policy

- Full ORDER files are generated and stored, but `GENERATED_DOCX` and `GENERATED_PDF` are not directly downloadable.
- Full ORDER preview is available only through the protected backend preview endpoint.
- ORDER_EXTRACT files are downloadable when `is_download_allowed=true`.

## Manual workflow check

1. Login as `admin`.
2. Create a new ORDER from `/documents/orders/new`.
3. Save draft, then generate preview.
4. Open document detail and confirm the PDF preview loads.
5. Send the ORDER for approval.
6. Login as the current approver and approve or return for revision.
7. After approval, send the document for acknowledgement.
8. Login as an assigned user and confirm acknowledgement.
9. Generate an extract and download the extract file from the detail page.

## Template references

Reference samples are stored under `backend/app/templates/samples/`.
Current generation is programmatic and uses those samples as field/layout references, not as runtime uploads.
