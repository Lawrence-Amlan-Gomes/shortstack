# Session State

**Status (2026-10-09):** Fresh deployment migration in progress. The co-founder role may run in Codex or Claude Code; both must use this repository and its shared handoff state. Lawrence requires $0 hosting with no payment card and explicitly chose to abandon recovery of the old Coolify database.

**Project:** ShortStack is an Express/React URL shortener with PostgreSQL, Redis caching, BullMQ click recording, multi-tenant auth, and a Docker build.

**Target:** Render Free Docker web service + Neon Free PostgreSQL + Upstash Free Redis. The existing Coolify/VPS deployment is not the target. No target resources have been created yet and no new URL is live.

**Completed in this migration:**
- Fixed BullMQ's Redis connection to use `ioredis`'s parsed host, credentials, and TLS options.
- Added `render.yaml` with a free Docker web service and secret prompts; short URLs use Render's hostname by default. Server and client production builds passed. Pushed as `0f9e6c0`.
- Added `MIGRATION.md` and `AGENTS.md` and refreshed `CLAUDE.md` for both agents. Pushed as `42bd5bf`.
- Configured Render and Neon hosted MCP endpoints in local Claude Code and Codex CLI settings. Authorization is still pending. Codex CLI's Render OAuth failed at dynamic client registration; its ChatGPT Render plugin is a separate option. Codex CLI's Neon OAuth was started but not completed. Claude Code OAuth has not been completed.
- GitHub CLI is already logged into the repository owner's account on this machine; Git pushes work.

**Exact next action:** Establish provider access that works from both Codex and Claude Code on this machine. Prefer shared provider CLI OAuth where available; otherwise authorize each MCP client separately. Then create the empty Neon Free project, a claimed Upstash Free Redis database, and the Render Free web service from `render.yaml`; set secrets through provider controls and verify the complete app on the Render URL.

**Open constraints and risks:** No card, no paid tier, no old data import. Render Free sleeps after 15 minutes idle; Upstash free command quota can be consumed by BullMQ polling. The old domain returns 503 and should not be used as a migration success signal. The local backend is not running because local Redis is unavailable. Do not commit `.env` or provider secrets.
