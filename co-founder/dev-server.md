# Dev Server Tracking

Tracks the local dev server a co-founder session started, so it can be found and killed reliably — including cleanup at `End Today`, and recovery if a previous session ended without cleaning up.

**Rule:** only ever kill a port/process recorded here as self-started. Never kill a port created outside the current co-founder session.

## Current state

**Status:** not running

- The previously recorded PID `63846` was absent when this session started. A fresh `PORT=4000 npm run dev` attempt was stopped after Redis connection refusals on `localhost:6379`; no process is listening on port `4000`.

## Notes carried over for next session

- Ports 3000 and 3001 have historically been occupied by Lawrence's *other* local projects (a Next.js app, and a Node+Express curriculum app using NextAuth) — check before assuming either is free. Port 4000 was used as a fallback for the backend.
- Local dev normally runs single-port: build the client (`npm run build` inside `client/`), then `npm run dev` (or `PORT=<port> npm run dev`) from the repo root — Express serves `client/dist` directly via `express.static`. This session also ran the Vite dev server on `:5173` in parallel for hot-reload frontend iteration, on request.
- `client/vite.config.ts`'s proxy target must match whatever port the backend is actually running on — it silently misroutes `/api` calls if it drifts (this happened once already: was stuck on `:3000`, fixed to `:4000` this session).
- If the API ends up on a non-default port, remember `.env`'s `BASE_URL` needs to match it too, or the `short` links returned by the API will point at the wrong port and silently fail to redirect. `.env` changes require a manual server restart — nodemon only watches `src/**/*.ts`, not `.env`.
