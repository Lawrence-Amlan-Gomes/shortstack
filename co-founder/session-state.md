# Session State

**Status (2026-10-09):** Fresh deployment migration is live at https://shortstack.lawrenceamlangomes.com. The co-founder role may run in Codex or Claude Code; both must use this repository and its shared handoff state. Lawrence requires $0 hosting with no payment card and explicitly abandoned recovery of the old Coolify database.

**Project:** ShortStack is an Express/React URL shortener with PostgreSQL, Redis caching, BullMQ click recording, multi-tenant auth, and a Docker build.

**Production:** Render Free Docker service `srv-db4iet2d0e5s73cfh5p0`, Neon Free project `twilight-fire-74293725`, and claimed Upstash Free Redis `8143338d-d9ae-4fa0-9dd4-ce56c3538b93` are live in Singapore. Porkbun CNAME points the original hostname to Render. The old Coolify/VPS deployment is no longer used.

**Completed in this migration:**
- Fixed BullMQ's Redis connection to use `ioredis`'s parsed host, credentials, and TLS options.
- Added `render.yaml` with a free Docker web service and secret prompts; short URLs use Render's hostname by default. Server and client production builds passed. Pushed as `0f9e6c0`.
- Added `MIGRATION.md` and `AGENTS.md` and refreshed `CLAUDE.md` for both agents. Pushed as `42bd5bf`.
- Render CLI OAuth is complete for `Amlan's workspace`; Neon CLI OAuth is complete in the macOS keyring. Both CLIs are available to Codex and Claude Code on this machine.
- Created fresh Neon Free PostgreSQL 16 project `shortstack` (`twilight-fire-74293725`) in Singapore and ran `src/db/migrate.ts`. Application tables exist with no old data.
- Upstash `shortstack` Redis was claimed; MCP confirmed active Free plan, Singapore primary, TLS, and TCP `PING`. Codex and Claude Code Upstash MCP authentication both succeeded. The separate Upstash CLI email/API-key login is unnecessary for MCP operations.
- Created Render Free Docker service and supplied Neon, Upstash, and app secrets through Render configuration. The service deployed and passed live health, homepage, link, cache, click, and auth tests.
- Added the original hostname as a Render custom domain; changed only its existing Porkbun `shortstack` A record to a CNAME for Render. Render verified the domain and HTTPS; `BASE_URL` now points to the custom hostname. Both coding clients have Porkbun's no-purchases MCP endpoint configured through the shared `mcp-remote` OAuth store.
- GitHub CLI is already logged into the repository owner's account on this machine; Git pushes work.

**Exact next action:** Recheck ordinary DNS resolution and HTTPS from the local Mac after its old-VPS DNS cache expires. Confirm the live domain still creates links with the original hostname, then continue product development.

**Open constraints and risks:** No card, no paid tier, no old data import. Render Free sleeps after idle time; Upstash free command quota can be consumed by BullMQ polling. Porkbun domain expires 2027-01-15 with auto-renew off; maintaining the original custom hostname after that date requires renewal. During cutover the Mac's recursive DNS cache alternated between old VPS IP and new Render CNAME even after authoritative and public resolvers had updated. Do not commit `.env` or provider secrets.
