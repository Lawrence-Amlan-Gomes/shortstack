# Session State

*(Updated at end of each session. Read this first when `@skill_coFounder.md` / co-founder mode is triggered — pointed to from `skillCoFounder.md`.)*

**Status:** Session 13 complete — real multi-tenant auth shipped (anonymous-allowed), 5 real bugs fixed, full test suite added, pushed to `main` (commit `afe1594`), Coolify redeploying.

**Project:** ShortStack — URL shortener with click analytics + shared multi-tenant auth API. Learning vehicle for full backend stack: Express → PostgreSQL → Docker → Redis → BullMQ → Nginx → Kafka → CDN → load balancing → Hostinger VPS deploy via Coolify.

**Live at:** https://shortstack.lawrenceamlangomes.com

**How this session's work got triggered:** Lawrence used a cross-project `Start Chat`/`End Chat` protocol to sync this project's cofounder Claude with the cofounder Claude on his separate "Node Express" curriculum project. That exchange produced an honest self-critique of ShortStack's auth, click pipeline, slug handling, redirect duplication, and JWT_SECRET fallback — all five became this session's real work.

**Last completed:**
- **Auth actually enforced, not just issued.** `src/middleware/authenticate.ts` (new) verifies a `Bearer` JWT and attaches `req.userId`/`req.tenantApp` (named `tenantApp`, not `app` — `req.app` is a reserved Express property, caught before it shipped). `links.user_id INTEGER REFERENCES users(id)` added via `migrate.ts`.
- **Login stays optional, by design.** `optionalAuthenticate` (same file) never blocks — attaches `userId` if a valid token is present, otherwise continues anonymously. `POST /api/links` uses this, not the strict `authenticate`. `insertLinkWithUniqueSlug()` takes `userId: number | null`; anonymous links get `user_id = null`. This was a deliberate reversal mid-session: first built a full frontend login/register screen (requiring auth), then Lawrence called for anonymous creation to keep working like before — the login UI was removed again, `client/src/App.tsx` is back to the original single shorten-form, no login wall. The strict `authenticate` middleware still exists, unused, for a future route that should actually require login.
- **Slug collisions handled.** `insertLinkWithUniqueSlug()` retries up to 5 times on Postgres unique-violation (`23505`) instead of surfacing a raw 500.
- **Two diverging redirect implementations reconciled.** `resolveSlug()` extracted in `links.ts`, shared by both root `/:slug` (in `app.ts`) and `/api/links/:slug` — one cache-aside + click-recording implementation instead of two.
- **JWT_SECRET fail-fast.** No more silent `'dev-secret'` fallback — `src/index.ts` refuses to boot without it, `auth.ts` throws rather than signing with a weak default. Confirmed set in Coolify before pushing.
- **Full test suite added** (`src/tests/links.test.ts`, 17 tests) — real Postgres test DB + real Redis, no mocks. Includes a genuine end-to-end assertion that a redirect produces a `clicks` row via the actual BullMQ worker (worker started in test setup) — previously this was untestable/untested.
- **Code comment convention** — every file in `src/`, `scripts/`, `client/src/`, and config files (`jest.config.ts`, etc.) now has a top-of-file plain-English summary plus a per-line comment. See the rule in `skillCoFounder.md` for the exact spec and the `//`-inside-template-literal gotcha it warns about.
- **Single-port local dev.** `client/dist` built via `npm run build` in `client/`, served by Express's existing `express.static` — same pattern as production. No separate Vite dev server. No hot reload in this mode — re-run the client build after frontend edits.
- **`co-founder/` folder created** — Claude's private working-notes space (this file, `dev-server.md`, `index.md`), referenced from `skillCoFounder.md` instead of holding everything inline there.
- **Pushed to `main`**, commit `afe1594`. Build (`npm run build`) and full test suite verified clean before push; staged diff scanned for secrets before committing.

**Real bugs found and fixed while building this (not hypothetical — each reproduced via the test suite):**
1. Test cleanup deleted `users` before `links` — violated the new FK. Fixed: delete/truncate in dependency order.
2. `redis.flushdb()` in test cleanup wiped BullMQ's own job-tracking keys mid-processing (cache and queue share one Redis DB via `REDIS_URL`) — corrupted the queue (`Missing key for job N`). Fixed by scoping cleanup to `slug:*` keys only. **Worth remembering generally**: cache/queue coupling on one Redis DB means a blanket flush anywhere is dangerous, not just in tests.
3. The 10/min rate limiters on `/api/links` and `/auth/*` were getting exhausted by the test file's own request volume, silently 429-ing later requests. Fixed with `skip: () => NODE_ENV === 'test'` (Jest sets this automatically) — doesn't touch prod behavior.
4. `//` is not a comment inside a backtick template literal — it's literal text. The first pass at commenting `migrate.ts` put `//` inside multi-line SQL strings, which corrupted the SQL and crashed the app on boot. Fixed using SQL's own `--` comment syntax inside the SQL strings. Documented as a standing gotcha in the comment-convention rule.
5. Local `.env`'s `BASE_URL` stayed `http://localhost:3000` while the dev server actually ran on port 4000 (3000/3001 were taken by Lawrence's other local projects) — every `short` link returned by the API pointed at the wrong port and didn't redirect. Fixed by setting `BASE_URL` to match the actual port and restarting (nodemon doesn't watch `.env`).

**New process rules established this session (all also written into `skillCoFounder.md` — that file is the source of truth, this is the summary):**
- No more asking Lawrence questions to prompt an answer/guess before explaining — explain directly instead.
- Claude writes the code and reports what it did — Lawrence isn't typing it himself anymore. Real departure from the confirmed-working step-by-step teaching method and from the project's "built to learn" purpose — flagged once, then followed.
- Cross-project `Start Chat`/`End Chat` relay protocol with Lawrence's other cofounder Claude.
- Mandatory local dev server at session start (report the port), only ever kill a self-started port, always kill it at `End Today`. Tracked in `dev-server.md` — reset to "not running" as of this session's end.
- Every file gets the full plain-English comment treatment (top-of-file summary + per-line comments).

**Open decisions:**
- ORM vs raw SQL — staying raw `pg` for now, Drizzle later.
- Worker runs in-process — fine for now, separate worker process is the prod-hardened path.
- Kafka, CDN, load balancing deferred — overkill at current scale, add as learning exercises later.
- Anonymous link creation is the resolved, permanent shape — not revisiting unless the product direction changes.

**Next action:** Token refresh.
1. Explain short-lived access tokens (15min) vs long-lived refresh tokens
2. Add `refresh_tokens` table to DB via migrate.ts
3. New `POST /api/auth/refresh` route
4. Update login to issue both tokens
(Note: register/login endpoints exist and work, but the frontend doesn't call them — anonymous creation is the primary flow by design. Token refresh matters for whoever does log in, and for any future route that uses the still-unused strict `authenticate` middleware.)

**Technical debt / deferred:**
- No token refresh — JWT expires in 7d, no renewal mechanism yet.
- No duplicate URL detection.
- No cache invalidation strategy if a URL ever needs updating (no update route yet).
- BullMQ retry config not explicitly set — using defaults; confirm what the actual default `attempts` value is before relying on retry behavior.
- Confirm the Coolify deploy from this session's push actually landed cleanly (check build/boot logs) — not yet confirmed as of session end.
- `name` column already dropped from users table in a prior migration — not debt, just noting migrate.ts handles it.

**Quality checklist remaining:**
- [x] DB indexes
- [x] Rate limiting
- [x] Security hardening (helmet, CORS tightening)
- [x] Multi-tenant auth actually enforced (was fake-wired)
- [x] Slug collision handling
- [x] Redirect logic reconciled (one implementation, not two)
- [x] Click pipeline verified end-to-end by tests
- [x] Auth made optional on link creation (matches live site behavior)
- [x] Full test suite (17 tests, real Postgres/Redis)
- [x] Code comments across the whole codebase
- [ ] Token refresh
- [ ] Confirm production deploy landed cleanly
