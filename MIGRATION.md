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
- No target services have been created. No card has been added.
- Render and Neon MCP endpoints were configured in the local Claude Code and Codex CLI settings. Neither account is authorized yet. Codex CLI's Render OAuth attempt failed during dynamic client registration; its ChatGPT plugin connection is a separate path. Codex CLI's Neon OAuth was not completed. Claude Code has not completed OAuth for either provider.

## Next sequence

1. Authorize a provider connection and create an empty Neon Free project.
2. Create a claimed Upstash Free Redis database; avoid the unclaimed three-day temporary database.
3. Create the Render Free web service from `render.yaml`, supplying Neon and Upstash URLs through the provider's secret fields.
4. Verify `/health`, homepage, link creation, redirect, click count, auth, and refresh on the Render URL.
5. Change DNS only if the existing domain remains registered and its DNS can be managed without a new payment.

## Shared agent access

Render's hosted MCP endpoint is `https://mcp.render.com/mcp`; Neon's is `https://mcp.neon.tech/mcp`. Both providers document Claude and Codex support. Each client needs its own OAuth authorization or another approved credential path. Never paste provider passwords, API keys, or connection strings into this file or a chat message.

## Free plan constraints

Render Free web services sleep after 15 minutes idle and have monthly quotas. Neon and Upstash also have free usage limits. Upstash supports BullMQ, but BullMQ's idle polling consumes Redis commands. Do not switch to paid resources or add a payment card.
