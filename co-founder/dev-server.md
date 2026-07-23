# Dev Server Tracking

Tracks the local dev server this Claude session started, so it can be found and killed reliably — including cleanup at `End Today`, and recovery if a previous session ended without cleaning up.

**Rule:** only ever kill a port/process recorded here as self-started. Never kill a port not created by this session's Claude.

## Current state

**Status:** running (single port — Lawrence chose the one-port-like-production setup over separate Vite+Express dev servers)

- **Port:** 4000 (3000 and 3001 were already taken by Lawrence's other local projects — never touch those)
- **PIDs:** nodemon (parent), ts-node 10067 (actual server — PID changes on each nodemon auto-restart from file edits; verified bound via `lsof -i :4000` and a real `/health` response)
- **Note:** `.env`'s `BASE_URL` was still `http://localhost:3000` (the documented default) while actually running on 4000 this session — meant every `short` link returned by the API pointed at the wrong port and didn't redirect. Fixed by setting `BASE_URL=http://localhost:4000` in `.env` for this session and restarting (nodemon doesn't watch `.env`). **Whoever runs this locally next: if the app ends up on a non-default port again, remember to update `BASE_URL` too, not just `PORT`.**
- **Command:** `PORT=4000 npm run dev` (background, run from repo root)
- **Client:** built once via `npm run build` inside `client/` (produces `client/dist/`), served directly by Express's `express.static` — same as production. No separate Vite dev server. **If you edit anything in `client/src`, you must re-run `npm run build` in `client/` for it to show up** — there's no hot reload in this mode.
- **Verified with:** `curl http://localhost:4000/health` → `{"status":"ok"}`; `curl http://localhost:4000/` serves the real built `index.html`; anonymous `POST /api/links` (no auth header) → 201, and the resulting link's `user_id` confirmed `null` in the database.
- **Open in a browser at:** http://localhost:4000/

(Earlier this session a separate Vite dev server ran on 5173 for a login-gated version of the frontend — that was reverted along with the login requirement itself; see `session-state.md`. Port 5173's process was killed since it was self-started.)

**Started:** 2026-07-23, this session.

Kill the API PIDs at `End Today`, then reset this section to "not running."
