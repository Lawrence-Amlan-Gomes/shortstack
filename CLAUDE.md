# ShortStack

## What this project is

URL shortener with click analytics. Built to learn elite backend engineering: Express → PostgreSQL → Docker → Redis → BullMQ → Nginx → Kafka → CDN → load balancing → VPS deploy.

## Current Phase

**Session 12 complete** — DB indexes, rate limiting, and security hardening shipped. Indexes on `links.slug` and `clicks.slug` live in Coolify Postgres. Rate limiting via `express-rate-limit` (10 req/min on POST /api/links, /auth/register, /auth/login). Helmet security headers on all responses. FRONTEND_URL set explicitly in Coolify. Next: token refresh (short-lived access tokens + long-lived refresh tokens).

## Architecture

- **Runtime:** Node.js + TypeScript
- **Framework:** Express 5
- **Entry:** `src/index.ts` (migration → listen) → `src/app.ts` (routes + middleware)
- **Frontend:** `client/` — Vite + React + TypeScript. Built to `client/dist/`, served by `express.static`. Dev: Vite on `:5173` with `/api` proxy to Express on `:3000`
- **Routes:**
  - `GET /` — serves React SPA (via express.static)
  - `GET /health` — server alive check
  - `GET /:slug` — 301 redirect + records click (root level, bit.ly style)
  - `POST /api/links` — create short URL (Zod validated)
  - `GET /api/links/:slug` — redirect (via linkRouter)
  - `GET /api/links/:slug/stats` — click count for a slug
  - `POST /api/auth/register` — multi-tenant register (email, password, app)
  - `POST /api/auth/login` — multi-tenant login (email, password, app)
- **Middleware:** `src/middleware/errorHandler.ts`, `cors`, `express.static`
- **Database:** PostgreSQL via `pg` pool — `src/db/pool.ts`
- **Cache:** Redis via `ioredis` — `src/redis/client.ts` (cache-aside on slug lookups, 24h TTL). Also exports `redisConnection` config for BullMQ
- **Queue:** BullMQ — `src/queues/clickQueue.ts` (producer), `src/workers/clickWorker.ts` (consumer). Click recording async — job enqueued on redirect, worker INSERTs into DB. Worker starts in-process at boot.
- **Migration:** `src/db/migrate.ts` — runs on boot, creates `links`, `clicks`, `users` tables
- **Observability:** Bull Board at `/admin/queues` — queue UI, protected by `express-basic-auth` (reads `BULL_BOARD_USER` / `BULL_BOARD_PASSWORD` env vars)
- **Proxy:** Nginx — `nginx/nginx.conf` (conf baked into `nginx/Dockerfile`). Uses Docker resolver `127.0.0.11` + variable upstream for runtime DNS. Sits between Traefik and Express.
- **Deploy:** `docker-compose.yml` (app + nginx services) → GitHub → Coolify docker-compose buildpack → VPS. App joins `coolify` external network to reach Redis.
- **Request chain:** Internet → Traefik (SSL, port 443) → Nginx (port 80, internal) → Express (port 3000, internal)
- **Live:** https://shortstack.lawrenceamlangomes.com

## Infrastructure

- **VPS:** Hostinger, IP `185.201.8.71`
- **Coolify:** https://coolify.lawrenceamlangomes.com
- **Postgres:** Coolify service, port 5432 publicly exposed
- **Redis:** Coolify service, on `coolify` Docker network (hostname `p14b0g5b0bem8q55tj3pehgv`)
- **Env vars in Coolify:** `DATABASE_URL`, `BASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `REDIS_URL`, `BULL_BOARD_USER`, `BULL_BOARD_PASSWORD`

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
| React frontend in /client (same repo) | SPA-from-API-server pattern — Express serves built static files, same URL, no CORS, one Coolify deployment | 2026-06-23 |
| express.static mounted before /:slug | Route order is load-bearing — static must intercept asset requests before the slug wildcard catches them | 2026-06-23 |
| Three-stage Dockerfile | client-builder and server-builder stages are independent — clean separation, smaller final image | 2026-06-23 |
| BullMQ async click recording | DB write on redirect path = latency + single point of failure. Queue decouples analytics from redirect — user never waits for DB write | 2026-06-24 |
| Worker in-process (not separate process) | Simple for now — one Coolify deployment, one process. Separate worker process is the prod-hardened path if queue grows | 2026-06-24 |
| Bull Board basic auth via express-basic-auth | Admin UI must not be publicly accessible — reads BULL_BOARD_USER/PASSWORD from env vars | 2026-06-24 |
| Nginx conf baked into image (not volume mount) | Volume mounts require file to exist on host first — baking into image is portable, reproducible, no host dependency | 2026-06-24 |
| expose not ports for nginx | Traefik owns host port 80/443 — nginx must be internal only, reachable via Docker network | 2026-06-24 |
| App joins coolify Docker network | Redis runs on coolify network — app must join it to resolve Redis hostname | 2026-06-24 |
| Nginx resolver 127.0.0.11 + variable upstream | Nginx caches DNS at startup — Docker's internal resolver + variable forces runtime resolution, handles container restarts | 2026-06-24 |
| docker-compose buildpack in Coolify | Enables multi-service deploy (app + nginx) from one repo — Coolify injects env vars, manages networking, adds Traefik labels | 2026-06-24 |
| DB indexes on links.slug and clicks.slug | Every redirect hits links WHERE slug — full table scan at scale is O(n). B-tree index makes it O(log n) | 2026-06-28 |
| Rate limiting via express-rate-limit | 10 req/min per IP on POST /api/links, /auth/register, /auth/login — prevents DB flooding and brute force | 2026-06-28 |
| Helmet for security headers | Sets X-Frame-Options, CSP, HSTS, nosniff and removes X-Powered-By in one line | 2026-06-28 |
| FRONTEND_URL set explicitly in Coolify | Was defaulting to '*' — too permissive for prod. Now locked to https://separate-frontend-one.vercel.app | 2026-06-28 |

## Skills

| Skill | Trigger | Purpose |
|---|---|---|
| `skills/skill_coFounder.md` | `@skill_coFounder.md` | Co-founder + senior mentor. Reads session state, briefs on progress, teaches while building. Say `End Today` to save session and update this file. |
| `skills/skill_gitAddCommitPush.md` | `@skills/skill_gitAddCommitPush.md` | Run build check, fix errors, commit, push to main. |

## Do Not Touch

- `.env` — never commit, never share (DB credentials)
- `185.201.8.71:5432` — Postgres publicly exposed for dev. Restrict to app-only when going to production.
