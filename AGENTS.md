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

---

## Demo Branch

- Branch: `demo` — static/client-side only, no DB, no AUTH_SECRET
- Data comes from `lib/data.ts` and `lib/erp-data.ts` (static fixtures)
- Deployed to Vercel: `https://entoto-riverside-farm.vercel.app`
- Auto-deploy on push via `.github/workflows/deploy-vercel.yml` (calls deploy hook)

## Pushing Large Files (>20 KB) — CRITICAL

**Never use background agents or `mcp__github__push_files` for files over ~20 KB.** They stall because the full content must travel through the agent context window as a JSON string parameter.

**Always use git plumbing instead:**

```bash
# 1. Write your file to /tmp/myfile.tsx  (already done)

# 2. Create a blob
BLOB=$(git hash-object -w /tmp/myfile.tsx)

# 3. Build updated subtrees bottom-up using Python (avoids grep tab issues)
python3 - << 'EOF'
import subprocess

demo_tip = subprocess.run(['git','rev-parse','origin/demo'], capture_output=True, text=True).stdout.strip()
# ... navigate tree, replace entry, call git mktree
EOF

# 4. Create the commit (signing works from the main repo, NOT from a worktree)
NEW_COMMIT=$(git commit-tree $NEW_ROOT_TREE -p $DEMO_TIP -m "your message")

# 5. Push
git push origin $NEW_COMMIT:refs/heads/demo
```

**Key rules:**
- `git commit-tree` signing **works** from `/home/user/entoto-riverside-farm` (main worktree)
- `git commit-tree` signing **fails** in `git worktree add` worktrees — do not use worktrees for commits
- Build trees bottom-up: `iot/` → `app/` → root. Use Python not bash grep to avoid duplicate entries
- Use `git ls-tree | python3` to replace a single entry without duplicating it

## Vercel Deploy (demo branch)

```bash
# Trigger build
curl -s -X POST "https://api.vercel.com/v1/integrations/deploy/prj_b5QmNZ0U1lMroyv2nRmh8FPUWFRg/sNyTA0fQmb"

# Poll until READY (check every 15s)
VERCEL_TOKEN="vcp_..."
until curl -s "https://api.vercel.com/v6/deployments?projectId=prj_b5QmNZ0U1lMroyv2nRmh8FPUWFRg&limit=1" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | python3 -c "
import sys,json; d=json.load(sys.stdin)
dep=d['deployments'][0]; print(dep['readyState'], dep['uid'])
" | grep -q "^READY"; do sleep 15; done

# Assign production alias
DEPLOY_ID="dpl_..."
curl -s -X POST "https://api.vercel.com/v2/deployments/$DEPLOY_ID/aliases" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"alias":"entoto-riverside-farm.vercel.app"}'
```

The deploy hook triggers a new build from the `demo` branch HEAD. The alias step makes it live at the production URL. Total time from push to live: ~15–30 seconds.
