# Dev Server Tracking

Tracks the local dev server a co-founder session started, so it can be found and killed reliably — including cleanup at `End Today`, and recovery if a previous session ended without cleaning up.

**Rule:** only ever kill a port/process recorded here as self-started. Never kill a port created outside the current co-founder session.

## Current state

**Status:** not running

- Started by a Claude Code session on 2026-10-09. At Codex End Today on 2026-10-10, PID `56948` was absent and port `4000` had no listener; Codex did not kill that process.
- That session ran `PORT=4000 npm run dev` (nodemon + ts-node), PID `56948`. Log: `/tmp/shortstack-dev.log`.
- That session built the client via `cd client && npm run build`; Express served it from `client/dist`. No separate Vite dev server was running.
- Verified end-to-end against the live free stack: `/health` OK, link creation, Redis cache HIT on redirect, 301 redirect — then deleted the proof link/click rows from Neon.

## Root cause of an earlier session's failure (fixed 2026-10-09)

`.env` was stale: `DATABASE_URL` still pointed at the abandoned Coolify VPS Postgres (`185.201.8.71`), and `REDIS_URL` was missing entirely (ioredis was defaulting to `localhost:6379`, which nothing is listening on locally — hence last session's "Redis connection refused" and the aborted `PORT=4000` attempt).

Fixed by pulling the real credentials directly from the providers instead of guessing:
- `DATABASE_URL` → `neon connection-string --project-id twilight-fire-74293725 --org-id org-round-heart-17180881` (Neon CLI is authenticated on this Mac).
- `REDIS_URL` → `mcp__upstash__redis_get_database` with `include_credentials: true` on database id `8143338d-d9ae-4fa0-9dd4-ce56c3538b93`, built as `rediss://default:<password>@neat-trout-216345.upstash.io:6379`.

Both now live in local `.env` (never committed). Local dev now talks to the same Neon + Upstash free-tier resources as production, not a local Postgres/Redis — there is no local Postgres/Redis running on this machine, so that's expected and correct going forward.

## Notes carried over for next session

- Ports 3000 and 3001 have historically been occupied by Lawrence's *other* local projects (a Next.js app, and a Node+Express curriculum app using NextAuth) — check before assuming either is free. Port 4000 was the backend's last local port.
- Local dev normally runs single-port: build the client (`npm run build` inside `client/`), then `npm run dev` (or `PORT=<port> npm run dev`) from the repo root — Express serves `client/dist` directly via `express.static`. Vite dev server on `:5173` is available in parallel for hot-reload frontend iteration, on request — if used, check `client/vite.config.ts`'s proxy target matches the backend's actual port first (it has drifted stale before).
- `.env` changes require a manual server restart — nodemon only watches `src/**/*.ts`, not `.env`. (Not an issue this session since `.env` was fixed before first start.)
