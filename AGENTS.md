<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Entoto Riverside Farm — Agent Operating Notes

## Stack

- **Next.js 16** (App Router) · TypeScript · Tailwind CSS · shadcn/ui
- **Prisma 7** + PostgreSQL 16 (adapter: `@prisma/adapter-pg`)
- **Auth.js v5** (NextAuth) — JWT strategy, Credentials provider
- **Docker Compose** deploy on AWS Lightsail Ubuntu (`54.171.14.135:3000`)
- **CI/CD**: push to `claude/disease-reporter-identification-g1MTI` → GitHub Actions → SSH → Lightsail

## Branch

Always develop on: `claude/disease-reporter-identification-g1MTI`

## Auth

- Config split: `auth.config.ts` (edge-safe, no DB imports) · `auth.ts` (full, Prisma + bcrypt)
- Proxy (middleware) lives in `proxy.ts` — imports only `auth.config.ts`
- Session `user.id` = `farmerId` (e.g. `"f-008"`) — not the `User.id` cuid
- Roles: `manager` · `supervisor` · `farmer`
- Demo credentials (use key icon on login page): `f-008 / manager2026`, `f-006 / supervisor01`, `f-007 / supervisor02`

## Database

- `DATABASE_URL` required at runtime and build time (build uses a placeholder)
- Migrations live in `prisma/migrations/` — name format: `YYYYMMDDHHMMSS_description`
- Seed: `npx prisma db seed` — idempotent upserts, runs automatically in the `migrate` Docker service on every deploy
- Never run `prisma migrate dev` in the Docker container — use `prisma migrate deploy`

## Docker / Deploy

- Three services: `postgres` → `migrate` (builder stage, runs migrations + seed) → `app` (runner stage)
- `migrate` service uses `target: builder` so it has full `node_modules` including `ts-node`
- `app` runner only has: `.next/standalone`, pruned Prisma deps, `scripts/start.sh` (`exec node server.js`)
- `.env` on the server is written by the deploy script — never commit secrets
- Passwords with `$` must be escaped as `$$` in Docker Compose `.env` files (handled by `dc_escape()`)
- The server has a 2 GB swap file (`/swapfile`) to prevent OOM during Docker builds

## API Conventions

- All routes in `app/api/` — auth check first: `const session = await auth(); if (!session) return 401`
- Role checks: read `(session.user as { role: string }).role`
- Farmer ID: `(session.user as { id: string }).id` (equals `farmerId`)
- Generic PATCH `/api/tasks/[id]` strips `reviewedBy`/`reviewedAt` from non-manager requests
- Action sub-routes follow the pattern `app/api/tasks/[id]/start/route.ts` etc.

## Task Flow

```
pending → in_progress → done
```

- `PATCH /api/tasks/[id]/start` — assignee only
- `PATCH /api/tasks/[id]/progress` — assignee only, appends `{ by, note, at }` to `progressNotes` JSON array
- `PATCH /api/tasks/[id]/complete` — assignee only, sets `completionNote` + optional `proofImageUrl`
- `PATCH /api/tasks/[id]/approve` — manager only, sets `reviewedBy` + `reviewedAt`
- `POST  /api/tasks/[id]/followup` — manager only, creates child Task with `parentTaskId`

## Key Files

| File | Purpose |
|---|---|
| `auth.config.ts` | Edge-safe NextAuth config (trustHost, JWT callbacks) |
| `auth.ts` | Full NextAuth with Credentials provider + Prisma |
| `proxy.ts` | Route protection (replaces `middleware.ts` in Next.js 16) |
| `lib/prisma.ts` | Prisma singleton with PrismaPg adapter |
| `lib/types.ts` | All shared TypeScript types |
| `lib/auth.ts` | `useAuth()` hook — `user`, `isManager`, `isSupervisor` |
| `prisma/schema.prisma` | Full DB schema |
| `prisma/seed.ts` | Idempotent seed data |
| `docker-compose.yml` | Three-service compose (postgres / migrate / app) |
| `deploy.sh` | Bootstrap script for fresh Lightsail instance |
| `.github/workflows/deploy.yml` | CI/CD: push → SSH → docker compose up |
| `app/tasks/page.tsx` | Full task management UI (1320 lines) |
| `app/api/tasks/[id]/` | Task action routes (start/progress/complete/approve/followup) |

## Verification After Deploy

```bash
# On the server
cd /opt/farm
sudo git rev-parse --short HEAD        # confirm commit SHA
sudo docker compose ps                  # postgres healthy, app Up, migrate Exited(0)
sudo docker compose logs migrate | tail -20
curl -I http://localhost:3000/login
```

GitHub Actions run status: `https://github.com/melamanager/entoto-riverside-farm/actions`
