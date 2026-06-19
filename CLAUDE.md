# ShortStack

## What this project is

URL shortener with click analytics. Built to learn elite backend engineering: Express → PostgreSQL → Docker → Redis → BullMQ → Nginx → Kafka → CDN → load balancing → VPS deploy.

## Current Phase

**Session 2 complete** — PostgreSQL connected. Real DB queries. Deployed live on VPS via Coolify with CI/CD. Next: click analytics.

## Architecture

- **Runtime:** Node.js + TypeScript
- **Framework:** Express 5
- **Entry:** `src/index.ts` (migration → listen) → `src/app.ts` (routes + middleware)
- **Routes:**
  - `GET /health` — server alive check
  - `GET /:slug` — 301 redirect (root level, bit.ly style)
  - `POST /api/links` — create short URL (Zod validated)
  - `GET /api/links/:slug` — redirect (via linkRouter)
- **Middleware:** `src/middleware/errorHandler.ts`
- **Database:** PostgreSQL via `pg` pool — `src/db/pool.ts`
- **Migration:** `src/db/migrate.ts` — runs on boot, creates `links` table
- **Deploy:** Dockerfile (multi-stage) → GitHub → Coolify CI/CD → VPS
- **Live:** https://shortstack.lawrenceamlangomes.com

## Infrastructure

- **VPS:** Hostinger, IP `185.201.8.71`
- **Coolify:** https://coolify.lawrenceamlangomes.com
- **Postgres:** Coolify service, port 5432 publicly exposed
- **Env vars in Coolify:** `DATABASE_URL`, `BASE_URL`

## Key Decisions Log

| Decision | Rationale | Date |
|---|---|---|
| Express over NestJS | Learn raw HTTP layer first, no magic | 2026-06-19 |
| Express 5 | Current stable version | 2026-06-19 |
| Split app.ts / index.ts | Separation of app config vs server boot — enables testing without port binding | 2026-06-19 |
| Raw `pg` over ORM | Lawrence sees real SQL first — Drizzle later | 2026-06-19 |
| Coolify Postgres over local Docker | No Docker Desktop on dev machine | 2026-06-19 |
| Root `/:slug` redirect | Standard URL shortener UX — slug at root not under /api | 2026-06-19 |

## Skills

| Skill | Trigger | Purpose |
|---|---|---|
| `skills/skill_coFounder.md` | `@skill_coFounder.md` | Co-founder + senior mentor. Reads session state, briefs on progress, teaches while building. Say `End Today` to save session and update this file. |
| `skills/skill_gitAddCommitPush.md` | `@skills/skill_gitAddCommitPush.md` | Run build check, fix errors, commit, push to main. |

## Do Not Touch

- `.env` — never commit, never share (DB credentials)
- `185.201.8.71:5432` — Postgres publicly exposed for dev. Restrict to app-only when going to production.
