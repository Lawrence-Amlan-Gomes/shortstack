# Dev Server Tracking

Tracks the local dev server this Claude session started, so it can be found and killed reliably — including cleanup at `End Today`, and recovery if a previous session ended without cleaning up.

**Rule:** only ever kill a port/process recorded here as self-started. Never kill a port not created by this session's Claude.

## Current state

**Status:** running (inherited from Session 14 — never cleaned up, still healthy)

- Port: 4000
- PID (nodemon parent, from `run_in_background` shell): 62981
- PID (actual node process bound to :4000, current after several nodemon auto-restarts from edits): 67777
- Command: `PORT=4000 npm run dev` (root of repo), stdout/stderr logged to `/tmp/shortstack-dev.log`
- Started: 2026-07-30, Session 14. Still running as of 2026-07-31, Session 15 — adopted rather than restarted since it's healthy and PID drift is just nodemon doing its job.
- Health check verified: `curl http://localhost:4000/health` → `{"status":"ok"}`

**Frontend (Vite dev server, hot-reload mode — added this session on request):**
- Port: 5173
- PID: 31654
- Command: `npm run dev` in `client/`, stdout/stderr logged to `/tmp/shortstack-vite.log`
- Started this session (2026-07-31, Session 15)
- `client/vite.config.ts` proxy target updated from `:3000` to `:4000` to match the actual backend port — was stale, would have silently misrouted `/api` calls otherwise

(Clear this section back to "not running" after killing it.)

## Notes carried over for next session

- Ports 3000 and 3001 have historically been occupied by Lawrence's *other* local projects (a Next.js app, and a Node+Express curriculum app using NextAuth) — check before assuming either is free. Port 4000 was used this session as a fallback.
- Local dev now runs single-port: build the client first (`npm run build` inside `client/`), then `npm run dev` (or `PORT=<port> npm run dev`) from the repo root — Express serves `client/dist` directly via `express.static`. No separate Vite dev server needed unless hot-reload frontend iteration is specifically wanted again.
- If the API ends up on a non-default port, remember `.env`'s `BASE_URL` needs to match it too, or the `short` links returned by the API will point at the wrong port and silently fail to redirect. `.env` changes require a manual server restart — nodemon only watches `src/**/*.ts`, not `.env`.
