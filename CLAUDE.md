# ShortStack

## What this project is

URL shortener with click analytics. Built to learn elite backend engineering: Express → PostgreSQL → Docker → Redis → BullMQ → Nginx → Kafka → CDN → load balancing → VPS deploy.

## Current Phase

**Session 13 complete** — multi-tenant auth is now actually enforced (was fake: JWTs issued but never verified, no `user_id` on links). Link creation stays anonymous-allowed by design (matches the live site's original UX) but attaches the real owner when a valid token is present. Five real bugs found and fixed along the way (slug collisions, duplicated redirect logic, silent JWT_SECRET fallback, an untested BullMQ click pipeline, test-cleanup ordering). Full Jest + Supertest suite added (17 tests, real Postgres/Redis, no mocks). Every file now has plain-English comments (top-of-file summary + per-line). Pushed to `main`, Coolify redeploying. Next: token refresh (short-lived access tokens + long-lived refresh tokens) for the register/login endpoints, which exist and work but aren't used by the frontend yet.

## Architecture

- **Runtime:** Node.js + TypeScript
- **Framework:** Express 5
- **Entry:** `src/index.ts` (migration → listen) → `src/app.ts` (routes + middleware)
- **Frontend:** `client/` — Vite + React + TypeScript. Built to `client/dist/`, served by `express.static`. No login screen — anonymous shorten form only. Local dev default: single-port, build the client (`npm run build` in `client/`) and let Express serve it, same as production. Vite dev on `:5173` with `/api` proxy is still available for hot-reload frontend iteration (proxy target in `client/vite.config.ts` is hardcoded to `:3000` — update it locally if the API is running on a different port)
- **Routes:**
  - `GET /` — serves React SPA (via express.static)
  - `GET /health` — server alive check
  - `GET /:slug` — 301 redirect + records click (root level, bit.ly style) — shares `resolveSlug()` in `src/routes/links.ts` with the route below, one cache-aside implementation, not two
  - `POST /api/links` — create short URL (Zod validated). Login is optional (`optionalAuthenticate`) — anonymous creation allowed (`user_id` null), attaches the real owner if a valid `Bearer` token is present. Retries on slug collision (Postgres `23505`) up to 5 times
  - `GET /api/links/:slug` — redirect (via linkRouter), same shared `resolveSlug()`
  - `GET /api/links/:slug/stats` — click count for a slug
  - `POST /api/auth/register` — multi-tenant register (email, password, app). Exists and works; not called by the frontend yet (no login UI)
  - `POST /api/auth/login` — multi-tenant login (email, password, app). Same as above
- **Middleware:** `src/middleware/errorHandler.ts`, `src/middleware/authenticate.ts` (`authenticate` — strict, 401 on missing/invalid token, currently unused by any route; `optionalAuthenticate` — never blocks, used by `POST /api/links`), `cors`, `express.static`
- **Database:** PostgreSQL via `pg` pool — `src/db/pool.ts`
- **Cache:** Redis via `ioredis` — `src/redis/client.ts` (cache-aside on slug lookups, 24h TTL). Also exports `redisConnection` config for BullMQ
- **Queue:** BullMQ — `src/queues/clickQueue.ts` (producer), `src/workers/clickWorker.ts` (consumer). Click recording async — job enqueued on redirect, worker INSERTs into DB. Worker starts in-process at boot.
- **Migration:** `src/db/migrate.ts` — runs on boot, creates `links`, `clicks`, `users` tables. `links.user_id` (nullable, `REFERENCES users(id)`) added Session 13
- **Testing:** `src/tests/links.test.ts` — Jest + Supertest against a real Postgres test DB and real Redis (not mocked), including the BullMQ worker actually running so click recording is verified end-to-end, not just the enqueue side. `npm test` (needs `.env.test`, see `.env.test.example`; `npm run test:setup` creates the test DB once)
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
| Login optional on link creation, not mandatory | Matches the live site's original UX — anyone can shorten a URL. `optionalAuthenticate` attaches an owner if a valid token is present, never blocks. Considered making auth mandatory first (built a full frontend login screen) but reverted — requiring login would have broken the only user-facing feature with no user warning | 2026-07-23 |
| Strict `authenticate` middleware kept but unused | Written for the mandatory-auth path before the reversal above. Left in place for a future route that should genuinely require login (e.g. "my links"), rather than deleted | 2026-07-23 |
| `resolveSlug()` unified in links.ts | Root `/:slug` and `/api/links/:slug` had silently diverged — one had caching + click tracking, the other didn't. One implementation now, shared by both | 2026-07-23 |
| JWT_SECRET fail-fast, no silent fallback | Previously defaulted to a hardcoded `'dev-secret'` if unset — a prod misconfiguration would fail silently into an insecure default. Now the app refuses to boot without it | 2026-07-23 |
| Real integration test suite (Jest + Supertest, real Postgres/Redis) | Mocked tests can pass while the real thing is broken — this project's whole click-recording pipeline had exactly that gap (enqueue tested, worker never run in tests) until this session | 2026-07-23 |
| Every source file gets plain-English comments | Lawrence is not a native English speaker and wants to be able to read any file back later and understand it line by line — top-of-file summary plus a comment on every code line. Full spec in `skill_coFounder.md` | 2026-07-23 |
| Local dev defaults to single-port (Express serves built client) | Matches production's serving model exactly, avoids proxy/port-mismatch bugs (one already happened: Vite's proxy pointed at the wrong port and silently hit a different local project). Vite dev server still available when hot-reload frontend iteration is specifically wanted | 2026-07-23 |

## Skills

| Skill | Trigger | Purpose |
|---|---|---|
| `skill_coFounder.md` | `@skill_coFounder.md` | Co-founder + senior mentor. Reads `co-founder/session-state.md`, briefs on progress, teaches while building. Say `End Today` to save session and update this file. Also defines the cross-project `Start Chat`/`End Chat` relay, the local dev-server start/stop rule, and the code comment convention. |
| `skill_gitAddCommitPush.md` | `@skill_gitAddCommitPush.md` | Run build check, fix errors, commit, push to main. |

`co-founder/` at the repo root is Claude's private working-notes folder (not for Lawrence) — `co-founder/index.md` lists what's in it, `co-founder/session-state.md` is the actual session log `skill_coFounder.md` reads/writes each session.

## Do Not Touch

- `.env` — never commit, never share (DB credentials)
- `185.201.8.71:5432` — Postgres publicly exposed for dev. Restrict to app-only when going to production.
