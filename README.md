# Client Project Dashboard

Full-stack real-time project/task dashboard with role-based access (Admin / Project Manager / Developer)
and a live, role-filtered activity feed.

## Stack

- **Frontend:** React + TypeScript (Vite)
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL via Prisma
- **Real-time:** Socket.io
- **Background jobs:** node-cron

## Local Setup (Docker, preferred)

```bash
docker compose up -d db      # start Postgres only
cd backend
cp .env.example .env         # adjust DATABASE_URL if not using Docker's db service
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev                  # http://localhost:4000

cd ../frontend
cp .env.example .env
npm install
npm run dev                  # http://localhost:5173
```

Seeded logins (password for all: `password123`):

| Role | Email |
|---|---|
| Admin | admin@agency.dev |
| PM | pm1@agency.dev, pm2@agency.dev |
| Developer | dev1@agency.dev ... dev4@agency.dev |

## Database Schema (summary)

```
User (id, email, passwordHash, name, role[ADMIN|PM|DEVELOPER])
Client (id, name)
Project (id, name, clientId -> Client, createdById -> User)
Task (id, projectId -> Project, title, description, assignedToId -> User,
      status[TODO|IN_PROGRESS|IN_REVIEW|DONE], priority[LOW|MEDIUM|HIGH|CRITICAL],
      dueDate, isOverdue)
ActivityLog (id, projectId -> Project, taskId -> Task, userId -> User,
             action, fromStatus, toStatus, createdAt)
Notification (id, userId -> User, taskId -> Task, message, type, read, createdAt)
```

**Indexes:** `Task.projectId`, `Task.assignedToId`, `Task.status`, `Task.dueDate`, `Task.priority` (all
filtered/sorted on directly by the task list endpoint); `ActivityLog.[projectId, createdAt]` and
`ActivityLog.[userId, createdAt]` (the two access patterns for the feed — "everything for a project" and
"everything a user should see" — as composite indexes so the DB can use one index instead of a filter +
sort); `Project.createdById` (PM ownership scoping runs on every project/task list request);
`Notification.[userId, read]` (unread-count queries).

## Architectural Decisions

- **Socket.io over raw WebSocket:** room-based broadcasting maps directly onto "different feed per
  role" (admin room, per-PM room, per-developer room), plus built-in reconnection — see comments in
  `backend/src/sockets/index.ts`.
- **node-cron over Bull for the overdue sweep:** the job is a single idempotent `SELECT`+`UPDATE`
  sweep with no need for retries or distributed workers; Bull would add a Redis dependency for no real
  benefit here. Noted as a limitation below if this ever runs on multiple instances.
- **Refresh token in an httpOnly cookie, access token in memory:** the refresh token never touches
  JS-accessible storage (mitigates XSS token theft); the access token lives in a module-level variable
  on the frontend and is silently refreshed via an axios response interceptor on 401.
- **Filters as query params:** task list filters (`status`, `priority`, `dueFrom`, `dueTo`) are read from
  and written to the URL, so a filtered view is a shareable/bookmarkable link, per spec.
- **Role enforcement at the API layer:** `requireAuth` + `requireRole` gate every protected route, and
  ownership checks (`loadProjectWithOwnershipCheck`, and inline checks in `updateTaskStatus`) additionally
  stop a PM or Developer from reaching another user's data even with a valid-but-wrong-scope token.

## Known Limitations

- The overdue cron job runs per-process; on multiple backend instances it would redundantly re-scan
  the same rows. A Postgres advisory lock or moving it to a proper job queue would fix this at scale.
- Notification delivery assumes a single Socket.io instance; horizontally scaling the backend would
  need the Socket.io Redis adapter to fan out `io.to(room).emit(...)` across instances.
- No automated test suite is included given the scope of this exercise; `updateTaskStatus`'s ownership
  branches and the overdue job are the two areas most worth covering first.
- Frontend styling is intentionally minimal (inline styles) to keep focus on the functional
  requirements — no design system was implemented.

## Deployment

- Backend: containerized via `backend/Dockerfile`; deploy alongside a managed Postgres instance (e.g.
  Railway, Render, or RDS) — Vercel's serverless functions aren't a good fit for a stateful Socket.io
  server, so the backend is best deployed to a long-running container host, with only the frontend on
  Vercel.
- Frontend: standard Vite build (`npm run build`), deployed as a static site on Vercel with
  `VITE_API_URL`/`VITE_SOCKET_URL` pointed at the deployed backend.
