# ShortStack

## What this project is

URL shortener with click analytics. Built to learn elite backend engineering: Express → PostgreSQL → Docker → Redis → BullMQ → Nginx → Kafka → CDN → load balancing → VPS deploy.

## Current Phase

**Session 5 complete** — Redis caching layer live. Cache-aside on slug redirects, write-through on create, X-Cache headers for observability. Next: BullMQ async click recording.

## Architecture

- **Runtime:** Node.js + TypeScript
- **Framework:** Express 5
- **Entry:** `src/index.ts` (migration → listen) → `src/app.ts` (routes + middleware)
- **Routes:**
  - `GET /health` — server alive check
  - `GET /:slug` — 301 redirect + records click (root level, bit.ly style)
  - `POST /api/links` — create short URL (Zod validated)
  - `GET /api/links/:slug` — redirect (via linkRouter)
  - `GET /api/links/:slug/stats` — click count for a slug
  - `POST /api/auth/register` — multi-tenant register (email, password, app)
  - `POST /api/auth/login` — multi-tenant login (email, password, app)
- **Middleware:** `src/middleware/errorHandler.ts`, `cors`
- **Database:** PostgreSQL via `pg` pool — `src/db/pool.ts`
- **Cache:** Redis via `ioredis` — `src/redis/client.ts` (cache-aside on slug lookups, 24h TTL)
- **Migration:** `src/db/migrate.ts` — runs on boot, creates `links`, `clicks`, `users` tables
- **Deploy:** Dockerfile (multi-stage) → GitHub → Coolify CI/CD → VPS
- **Live:** https://shortstack.lawrenceamlangomes.com

## Infrastructure

- **VPS:** Hostinger, IP `185.201.8.71`
- **Coolify:** https://coolify.lawrenceamlangomes.com
- **Postgres:** Coolify service, port 5432 publicly exposed
- **Redis:** Coolify service, internal only (not publicly exposed)
- **Env vars in Coolify:** `DATABASE_URL`, `BASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `REDIS_URL`

## Key Decisions Log

| Decision | Rationale | Date |
|---|---|---|
| Express over NestJS | Learn raw HTTP layer first, no magic | 2026-06-19 |
| Express 5 | Current stable version | 2026-06-19 |
| Split app.ts / index.ts | Separation of app config vs server boot — enables testing without port binding | 2026-06-19 |
| Raw `pg` over ORM | Lawrence sees real SQL first — Drizzle later | 2026-06-19 |
| Coolify Postgres over local Docker | No Docker Desktop on dev machine | 2026-06-19 |
| Root `/:slug` redirect | Standard URL shortener UX — slug at root not under /api | 2026-06-19 |
| Separate `clicks` table over `click_count` column | Enables time-series analytics, teaches JOINs and COUNT — counter column can't answer "clicks per day" | 2026-06-20 |
| Multi-tenant auth via `app` field | Same email can register independently per app — UNIQUE(email, app) not just email | 2026-06-20 |
| JWT in response body, not httpOnly cookie | Frontend is on a different domain (Vercel) — cookie rules get complicated cross-origin, body token is simpler for external clients | 2026-06-20 |
| ioredis over redis npm package | Built-in TypeScript types, auto-reconnect, battle-tested | 2026-06-23 |
| Cache-aside pattern for slug lookups | Read Redis first, fall back to DB on miss — standard pattern for read-heavy workloads | 2026-06-23 |
| Write-through on POST /api/links | Cache warm on create — first redirect always HIT, no cold start | 2026-06-23 |
| 24h TTL on cached slugs | Bounds stale data without being too aggressive — slugs rarely change | 2026-06-23 |
| X-Cache header for observability | Industry standard (CDN pattern) — easy to verify cache behavior with curl | 2026-06-23 |

## Skills

| Skill | Trigger | Purpose |
|---|---|---|
| `skills/skill_coFounder.md` | `@skill_coFounder.md` | Co-founder + senior mentor. Reads session state, briefs on progress, teaches while building. Say `End Today` to save session and update this file. |
| `skills/skill_gitAddCommitPush.md` | `@skills/skill_gitAddCommitPush.md` | Run build check, fix errors, commit, push to main. |

## Do Not Touch

- `.env` — never commit, never share (DB credentials)
- `185.201.8.71:5432` — Postgres publicly exposed for dev. Restrict to app-only when going to production.
