# Session State

*(Updated at end of each session. Read this first when `@skill_coFounder.md` / co-founder mode is triggered — pointed to from `skillCoFounder.md`.)*

**Status:** Session 15 complete — token refresh shipped, plus a new landing page section for the system architecture diagram. Pushed to `main` (commit `24218b3`), Coolify redeploying.

**Project:** ShortStack — URL shortener with click analytics + shared multi-tenant auth API. Learning vehicle for full backend stack: Express → PostgreSQL → Docker → Redis → BullMQ → Nginx → Kafka → CDN → load balancing → Hostinger VPS deploy via Coolify.

**Live at:** https://shortstack.lawrenceamlangomes.com

**How this session started:** picked up mid-flight — Session 14 had left the local dev server running and undocumented drift (stale PIDs in `dev-server.md`), and a full token-refresh implementation sitting uncommitted in the working tree (migrate.ts, auth.ts, app.ts, tests) alongside Session 13's own uncommitted `End Today` docs update. Verified all of it (build clean, 21/21 tests passing) before treating it as done.

**Last completed:**
- **Token refresh (the item queued since Session 13).** `refresh_tokens` table added via `migrate.ts` (`user_id`, `token_hash`, `expires_at`, `revoked_at`). `src/routes/auth.ts`: access tokens now expire in 15 minutes (`ACCESS_TOKEN_EXPIRY`); `issueRefreshToken()` generates a random 48-byte token, stores only its SHA-256 hash (never the raw token), 30-day TTL. New `POST /api/auth/refresh` — looks up by hash, rejects unknown/reused/expired tokens with distinct error messages, rotates on every successful use (marks the old one `revoked_at`, issues a fresh pair). Register/login now return both `token` and `refreshToken`. Rate-limited via the existing `authLimiter` in `app.ts`. 4 new tests cover success, reuse-rejection, invalid-token, and expired-token cases.
- **Landing page architecture diagram section.** `client/public/` created (didn't exist before — the diagram image had been placed in the wrong `src/` by mistake, moved to the correct spot). `client/src/App.tsx` restructured into two stacked `<section>`s: `.hero` (the existing shorten form, now explicitly `min-height: 100vh`, was previously full-height only as a side effect of `body`'s flex-centering) and `.architecture` (new — heading + the diagram image, also `min-height: 100vh`, image capped at `65vh` with `object-fit: contain` so it can't overflow the section, no drop shadow per request). `body`'s flex-centering was removed since it's no longer a single-box page.
- **Vite dev proxy fixed.** `client/vite.config.ts`'s `/api` proxy target was hardcoded to `:3000`, stale from whenever the backend last ran there. Backend has been on `:4000` locally for two sessions now — proxy silently pointed at nothing/the wrong project until fixed this session. Worth checking this file specifically any time the backend's local port changes.
- **Dev server hygiene recovered.** Session 14's backend dev server (port 4000) had been left running with no `End Today` cleanup — found it still healthy, adopted it (updated its PID in `dev-server.md` to match reality after nodemon's auto-restarts) rather than needlessly killing and restarting. Also ran a Vite dev server on `:5173` in parallel this session for hot-reload frontend iteration, per request. Both killed cleanly at this session's `End Today`.
- **Pushed to `main`**, commit `24218b3` — bundles the token-refresh backend work and the frontend diagram section together, since both were independently build-clean and test-verified with no reason to hold either back.

**Open decisions:**
- ORM vs raw SQL — staying raw `pg` for now, Drizzle later.
- Worker runs in-process — fine for now, separate worker process is the prod-hardened path.
- Kafka, CDN, load balancing deferred — overkill at current scale, add as learning exercises later.
- Anonymous link creation is the resolved, permanent shape — not revisiting unless the product direction changes.
- Frontend still has no login/register UI — register/login/refresh all exist and work, but only the anonymous shorten form is user-facing. Not queued to change; revisit only if the product direction calls for a "my links" view (which is also what the still-unused strict `authenticate` middleware is waiting for).

**Next action:** Confirm the Coolify deploy of `24218b3` actually landed cleanly — check build/boot logs, then load https://shortstack.lawrenceamlangomes.com and verify the architecture diagram section renders as expected in production (was only checked locally on `:4000` and `:5173` this session, never against the real deployed build/CDN path).

**Technical debt / deferred:**
- No duplicate URL detection.
- No cache invalidation strategy if a URL ever needs updating (no update route yet).
- BullMQ retry config not explicitly set — using defaults; confirm what the actual default `attempts` value is before relying on retry behavior.
- `clicks_slug_fkey` violation logs during test teardown (BullMQ worker processing a click job for a link the test cleanup already deleted) — tests still pass since BullMQ just retries/logs the failure, but it's noise worth investigating for real someday. Pre-existing, not touched this session.
- No frontend UI yet for login/register/refresh — endpoints work but nothing calls them from `client/`.

**Quality checklist remaining:**
- [x] DB indexes
- [x] Rate limiting
- [x] Security hardening (helmet, CORS tightening)
- [x] Multi-tenant auth actually enforced (was fake-wired)
- [x] Slug collision handling
- [x] Redirect logic reconciled (one implementation, not two)
- [x] Click pipeline verified end-to-end by tests
- [x] Auth made optional on link creation (matches live site behavior)
- [x] Full test suite (21 tests, real Postgres/Redis)
- [x] Code comments across the whole codebase
- [x] Token refresh
- [ ] Confirm production deploy of `24218b3` landed cleanly and renders correctly
