# Session State

**Status (2026-10-09):** Fresh deployment migration in progress. The co-founder role may run in Codex or Claude Code; both must use this repository and its shared handoff state. Lawrence requires $0 hosting with no payment card and explicitly chose to abandon recovery of the old Coolify database.

**Project:** ShortStack is an Express/React URL shortener with PostgreSQL, Redis caching, BullMQ click recording, multi-tenant auth, and a Docker build.

**Target:** Render Free Docker web service + Neon Free PostgreSQL + Upstash Free Redis. The existing Coolify/VPS deployment is not the target. Neon is ready; Upstash and Render are pending, and no new URL is live.

**Completed in this migration:**
- Fixed BullMQ's Redis connection to use `ioredis`'s parsed host, credentials, and TLS options.
- Added `render.yaml` with a free Docker web service and secret prompts; short URLs use Render's hostname by default. Server and client production builds passed. Pushed as `0f9e6c0`.
- Added `MIGRATION.md` and `AGENTS.md` and refreshed `CLAUDE.md` for both agents. Pushed as `42bd5bf`.
- Render CLI OAuth is complete for `Amlan's workspace`; Neon CLI OAuth is complete in the macOS keyring. Both CLIs are available to Codex and Claude Code on this machine.
- Created fresh Neon Free PostgreSQL 16 project `shortstack` (`twilight-fire-74293725`) in Singapore and ran `src/db/migrate.ts`. Application tables exist with no old data.
- Installed Upstash CLI 1.5.0 and configured its MCP server and skill for both coding clients. Codex MCP OAuth succeeded. Claude Code's separate OAuth consent is pending. The CLI requires a separate Upstash email/API key and is not logged in.
- Created anonymous Upstash Redis `8143338d-d9ae-4fa0-9dd4-ce56c3538b93` and opened its claim page. It has zero keys and expires 2026-10-12 unless claimed; do not use it for production until claim and TCP credentials are confirmed.
- GitHub CLI is already logged into the repository owner's account on this machine; Git pushes work.

**Exact next action:** Finish Upstash account OAuth/claim, obtain a Free plan TCP Redis URL, then create the Render Free Docker web service with Neon and Upstash secrets and verify the full app on its Render URL.

**Open constraints and risks:** No card, no paid tier, no old data import. Render Free sleeps after 15 minutes idle; Upstash free command quota can be consumed by BullMQ polling. The old domain returns 503 and should not be used as a migration success signal. The local backend is not running because local Redis is unavailable. Do not commit `.env` or provider secrets.
