# Demokratie

A Raspberry Pi-friendly web app with a React frontend, Node.js backend, and SQLite persistence for image-driven questionnaire sessions.

## Features

- Full-screen image flow with keyboard-first interaction (press Enter).
- Sequential per-image questions in a custom soft dialog UI.
- Anonymous sessions with `session_uid` and start/end timestamps.
- Version-agnostic, collision-safe image naming (`<image_uid>.<ext>`).
- Admin panel for image/question CRUD, response export, and backup generation.
- SQLite + filesystem storage under `data/` for easy transfer and backups.

## Project Layout

- `backend/` Express API + SQLite migrations + admin/public routes.
- `frontend/` React (Vite) UI for visitor flow, summary, and admin.
- `data/` SQLite DB + images + backup archives.
- `scripts/` backup and restore shell scripts.

## Local Development

```bash
cd demokratik-webapp
npm install
npm run dev -w backend
npm run dev -w frontend
```

Backend: `http://localhost:3001`
Frontend: `http://localhost:5173`
Admin: `http://localhost:5173/admin`

## Environment

Copy `.env.example` to `.env` and adjust values.

Required:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `JWT_SECRET`

## Tests

```bash
cd demokratik-webapp
npm test -w backend
```

## Docker

```bash
cd demokratik-webapp
docker compose up --build
```

Frontend: `http://localhost:8080`
Backend API: `http://localhost:3001`

## Raspberry Pi Multi-Arch Image Build

```bash
cd demokratik-webapp
docker buildx build --platform linux/arm/v7,linux/arm64,linux/amd64 -f backend/Dockerfile -t demokratie-backend:latest .
docker buildx build --platform linux/arm/v7,linux/arm64,linux/amd64 -f frontend/Dockerfile -t demokratie-frontend:latest .
```

## Backup and Restore

Create backup:

```bash
cd demokratik-webapp
chmod +x scripts/backup.sh scripts/restore.sh
./scripts/backup.sh ./data
```

Restore backup:

```bash
cd demokratik-webapp
./scripts/restore.sh ./data/backups/backup-YYYYMMDD-HHMMSS.tar.gz ./data
```

## API Summary

Public:
- `POST /api/sessions`
- `POST /api/sessions/:sessionUid/complete`
- `GET /api/images`
- `GET /api/images/:id/questions`
- `POST /api/responses`
- `GET /api/sessions/:sessionUid/summary`

Admin:
- `POST /api/admin/login`
- `GET/POST/PUT/DELETE /api/admin/images`
- `GET/POST/PUT/DELETE /api/admin/questions`
- `GET /api/admin/responses?format=csv`
- `POST /api/admin/backup`
- `GET /api/admin/backups/:name`
