# BDG & PODS Analytics Dashboard — Implementation Plan

## Status: Complete (MVP end-to-end verified)

## Overview

Full-stack internal analytics dashboard for uploading, parsing, normalizing, and visualizing BDG lead reports and PODS completion reports.

## Architecture

```
apps/web          React + Vite + MUI frontend
apps/api          NestJS + Prisma backend
packages/shared   Shared types, column maps, validators
docker-compose.yml PostgreSQL on host port 5435
```

## Phase Checklist

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Monorepo, Docker, NestJS, Vite | Done |
| 2 | Prisma schema, migrations, seed | Done |
| 3 | JWT auth, layout, navigation | Done |
| 4 | Upload system, CSV/Excel parsers | Done |
| 5 | BDG import/upsert + dashboard | Done |
| 6 | PODS import/upsert + daily updates + dashboard | Done |
| 7 | DOCX/PDF parsers, column mapping | Done |
| 8 | Import preview/commit/history | Done |
| 9 | Charts, filters, search, export | Done |
| 10 | Tests, security, polish, README | Done |

## Verified locally

- Login JWT works
- Seed data loads dashboards from PostgreSQL
- `sample-data/PODS.xlsx` preview + commit (Info + Daily Update)
- `sample-data/BDG_Lead_Report_*.docx` preview + commit
- Re-upload PODS is idempotent (0 created / N updated, no duplicates)
- Frontend Vite proxy `/api` → backend

## Upsert Rules

1. BDG: `normalizedMemberName` unique → update or insert
2. POD: `normalizedName` unique → update Info fields
3. Daily: `(podId, date)` unique → update or insert; history preserved
