# BDG & PODS Analytics Dashboard

Production-oriented internal analytics platform for uploading, validating, importing, and visualizing **BDG** lead reports and **PODS** completion reports.

## 1. Project overview

Authorized users can:

1. Upload BDG or PODS reports (CSV, XLS, XLSX, DOC, DOCX, PDF)
2. Automatically parse and normalize records
3. Preview validation results before commit
4. Upsert into PostgreSQL with uniqueness guarantees
5. Explore dedicated BDG and PODS dashboards with charts, filters, and exports

## 2. Architecture

```text
apps/web        React + Vite + MUI frontend
apps/api        NestJS REST API + file parsers + import pipeline
packages/shared Shared types, column mapping, normalization helpers
PostgreSQL      Source of truth via Prisma
```

Import pipeline:

```text
Upload → Detect → Parse → Normalize → Validate → Preview → Confirm → Upsert
```

## 3. Technology stack

| Layer | Tech |
|-------|------|
| Frontend | React, TypeScript, Vite, React Router, MUI, Recharts, Axios, React Hook Form |
| Backend | NestJS, TypeScript, Multer, JWT, Zod/class-validator |
| Database | PostgreSQL + Prisma |
| Parsers | Papa Parse, SheetJS, Mammoth, pdf-parse |

## 4. Installation

```bash
# from repo root
cp .env.example .env
docker compose up -d
npm install
cp .env apps/api/.env
npm run build -w @bdg-pods/shared
npm run db:generate -w @bdg-pods/api
cd apps/api && npx prisma migrate dev --name init && cd ../..
npm run db:seed -w @bdg-pods/api
npm run build -w @bdg-pods/api
npm run dev
```

- API: http://localhost:3000/api
- Web: http://localhost:5173
- Postgres (Docker): localhost **5435** (host 5432 is often already in use)

## 5. Environment variables

See `.env.example`:

```text
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=7d
PORT=3000
FRONTEND_URL=http://localhost:5173
MAX_UPLOAD_SIZE_MB=20
UPLOAD_DIR=./uploads
```

## 6. Database setup

```bash
docker compose up -d
```

Postgres credentials (dev):

- User: `bdgpods`
- Password: `bdgpods_secret`
- DB: `bdg_pods_dashboard`
- Port: `5435` (mapped from container 5432; change in `docker-compose.yml` if needed)

## 7. Prisma migrations

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

## 8. Running backend

```bash
npm run dev:api
```

## 9. Running frontend

```bash
npm run dev:web
```

Or both:

```bash
npm run dev
```

## 10. Docker

Only PostgreSQL is containerized for local development:

```bash
docker compose up -d
docker compose down
```

## 11. Supported upload formats

- CSV
- XLS / XLSX
- DOC / DOCX
- PDF (machine-readable text/tables; fails clearly when unreliable)

## 12. BDG import rules

- Unique key: normalized `BDG Member` name
- Same member (ignoring case/whitespace) → **UPDATE**
- New member → **INSERT**
- Invalid rows are shown in preview and skipped on commit

## 13. POD import rules

- Unique key: normalized `POD Name`
- Info sheet updates current POD fields
- Supports workbook sheets: `Info` + `Daily Update`

## 14. Daily update rules

- Unique key: `(podId, date)`
- Same POD + same date → UPDATE
- Same POD + new date → INSERT
- Historical daily rows are never deleted by a new upload

## 15. API endpoints

### Auth
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`

### Uploads
- `POST /api/uploads` (ADMIN)
- `GET /api/uploads`
- `GET /api/uploads/:id`

### Imports
- `POST /api/imports/preview` (ADMIN)
- `POST /api/imports/commit` (ADMIN)
- `GET /api/imports`
- `GET /api/imports/:id`

### BDG
- `GET /api/bdg`
- `GET /api/bdg/:id`
- `GET /api/bdg/summary`
- `GET /api/bdg/by-region`
- `GET /api/bdg/top-members`
- `GET /api/bdg/export`

### PODS
- `GET /api/pods`
- `GET /api/pods/:id`
- `GET /api/pods/summary`
- `GET /api/pods/status`
- `GET /api/pods/completion`
- `GET /api/pods/:id/history`
- `GET /api/pods/export`

### Dashboard
- `GET /api/dashboard/summary`

## 16. Testing

```bash
npm test
```

Covers normalization, BDG/POD upsert preview logic, daily matrix parsing, CSV/XLSX parsers, and validation edge cases.

## 17. Troubleshooting

| Issue | Fix |
|-------|-----|
| DB connection refused | `docker compose up -d` and verify `DATABASE_URL` |
| JWT errors | Ensure `JWT_SECRET` is set in `apps/api/.env` |
| PDF parse fails | Use Excel/CSV/DOCX; PDF must contain extractable text tables |
| Upload rejected | Check extension + MIME + size (`MAX_UPLOAD_SIZE_MB`) |
| Empty dashboards | Run seed or import sample files from `sample-data/` |

### Seed accounts

Authentication has been removed for this internal MVP. The app opens directly to the dashboard with no login screen.

Optional seed users may still exist in the database for future use, but they are not required to use the application.


### Sample files

- `sample-data/PODS.xlsx`
- `sample-data/BDG_Lead_Report_24-27_Aug_2026.docx`
