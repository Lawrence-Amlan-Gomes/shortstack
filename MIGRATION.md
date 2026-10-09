# ShortStack fresh deployment

## Decision

- $0 hosting with no payment card.
- Start with an empty PostgreSQL database; do not recover old Coolify data.
- Preserve the current Express, React, PostgreSQL, Redis, and BullMQ behavior.
- Target: Render Free Docker web service, Neon Free PostgreSQL, Upstash Free Redis.
- Keep code and deployment configuration in this GitHub repository so Codex and Claude can both operate the project.

## Current status

- `render.yaml` defines a free Render Docker web service and prompts for `DATABASE_URL` and `REDIS_URL` during creation. It generates `JWT_SECRET` and the Bull Board password.
- `src/redis/client.ts` passes parsed host, credentials, and TLS options to BullMQ.
- `src/routes/links.ts` uses `RENDER_EXTERNAL_HOSTNAME` for new short URLs when `BASE_URL` is unset.
- Server and client production builds passed locally. YAML parsing passed. Changes were pushed to `main` in `0f9e6c0`.
- A fresh Neon Free PostgreSQL 16 project, `shortstack` (`twilight-fire-74293725`), exists in Singapore. Its empty `shortstack` database has the application tables from `src/db/migrate.ts`. No old Coolify data was imported.
- The Render CLI is logged in to `Amlan's workspace` and the Neon CLI is logged in through the macOS keyring. Both are available to Codex and Claude Code under the same macOS user. Render has no ShortStack service yet.
- Upstash CLI 1.5.0 is installed. Its MCP server and skill are configured for both Codex and Claude Code. Codex MCP OAuth succeeded; Claude Code's separate OAuth consent is pending. The CLI requires a separate account email/API key and is not logged in. The anonymous Redis database `8143338d-d9ae-4fa0-9dd4-ce56c3538b93` remains temporary and expires on 2026-10-12 unless claimed. It has no application data. No payment card has been added.

## Next sequence

1. Claim the temporary Upstash database into the account or create an account-owned Free database, then obtain its TCP Redis URL and confirm its Free plan.
2. Create the Render Free web service, supplying the Neon and Upstash URLs through Render's secret fields.
3. Verify `/health`, homepage, link creation, redirect, click count, auth, and refresh on the Render URL.
4. Change DNS only if the existing domain remains registered and its DNS can be managed without a new payment.

## Shared agent access

The co-founder role can run in Codex or Claude Code. The authenticated Render and Neon CLIs, GitHub CLI, and repository are shared on this machine. The Upstash CLI and its remote MCP integration are installed for both clients; the Upstash account still needs authorization. A ChatGPT plugin connection does not authorize Claude Code; each MCP client needs its own OAuth authorization unless a provider CLI login in the shared local user account is used. Never paste provider passwords, API keys, or connection strings into this file or a chat message.

## Free plan constraints

Render Free web services sleep after 15 minutes idle and have monthly quotas. Neon and Upstash also have free usage limits. Upstash supports BullMQ, but BullMQ's idle polling consumes Redis commands. Do not switch to paid resources or add a payment card.
