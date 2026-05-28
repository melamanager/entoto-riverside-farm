# Agent Notes

This project is the ENTOTO Riverside Farm management app. Use this file as the quick operating guide before making changes.

## Project

- Stack: Next.js 16 App Router, React 19, Tailwind CSS 4, Prisma, Postgres, Docker Compose.
- Main app code lives in `app/`, shared UI/data helpers in `components/` and `lib/`, database schema/seed in `prisma/`.
- Read `AGENTS.md` before coding. This repo uses newer Next.js behavior, so check local Next docs in `node_modules/next/dist/docs/` when unsure.

## Branch And Deploy

- Active deploy branch: `claude/disease-reporter-identification-g1MTI`.
- GitHub Actions also deploys `master`.
- Any push to either deploy branch triggers `.github/workflows/deploy.yml`.
- Production server path: `/opt/farm`.
- Server username: `ubuntu`.
- Server host: `54.171.14.135`.
- App port: `3000`.

Manual deploy from the server:

```bash
cd /opt/farm
sudo git config --global --add safe.directory /opt/farm
sudo git fetch origin
sudo git checkout claude/disease-reporter-identification-g1MTI
sudo git pull origin claude/disease-reporter-identification-g1MTI
sudo docker compose up -d --build
sudo docker compose ps
sudo docker compose logs --tail=80 app
```

Health check:

```bash
curl -I http://localhost:3000/login
curl http://localhost:3000/api/health
```

The workflow currently checks `/login` because authenticated API routes may redirect when no session exists.

## Dynamic Dropdowns

Most form dropdowns are dynamic now.

- Defaults live in `lib/options.ts`.
- Client hook: `lib/use-options.ts`.
- API route: `app/api/options/route.ts`.
- Database storage: `AppSetting` rows with keys like `options.varieties`, `options.farmerRoles`, `options.taskCategories`.
- Manager UI: `Settings -> Dropdown Options`.

When adding a new dropdown:

1. Add a default list to `OPTION_DEFAULTS` in `lib/options.ts`.
2. Read it with `useOptions()` in client components.
3. Keep database entity dropdowns dynamic from their own APIs, not from `options.*`.
4. If an option is tied to a Prisma enum, make sure the submitted `value` matches what the API expects.

## Build And Checks

Run before committing:

```bash
npm run build
```

For local placeholder builds, a fake `DATABASE_URL` is acceptable for type/build checks:

```powershell
$env:DATABASE_URL='postgresql://user:pass@localhost:5432/db'
npm run build
```

Prisma may log an error during static generation if the placeholder database is not real, but the important signal is whether the build exits successfully.

## Database And Seed

Seed on the server:

```bash
cd /opt/farm
sudo docker compose run --rm app npx tsx prisma/seed.ts
```

If that image command is unavailable, use the app container:

```bash
cd /opt/farm
sudo docker compose exec app npx tsx prisma/seed.ts
```

## Recent Important Fixes

- CRUD persistence for beds, valves, and employees was added.
- Auto deploy was fixed by using `sudo` and Git safe-directory config on Lightsail.
- Dynamic dropdown support was added for form option lists.
- Packaging API normalizes package sizes such as `500g` to Prisma enum values before create/update.

## Safety

- Do not commit secrets or `.env` files.
- Do not reset or discard user changes without explicit approval.
- Prefer small, focused commits.
- After pushing to a deploy branch, confirm GitHub Actions success and then verify the server commit/container status.
