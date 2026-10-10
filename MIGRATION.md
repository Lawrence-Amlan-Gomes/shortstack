# ShortStack deployment

## Live deployment

- Public URL: https://shortstack.lawrenceamlangomes.com
- Render Free Docker web service: `shortstack-lawrence` (`srv-db4iet2d0e5s73cfh5p0`), Singapore. Render fallback URL: https://shortstack-lawrence.onrender.com
- Neon Free PostgreSQL 16 project: `shortstack` (`twilight-fire-74293725`), Singapore. Database: `shortstack`.
- Upstash Free Redis: `shortstack` (`8143338d-d9ae-4fa0-9dd4-ce56c3538b93`), Singapore, TLS. The database was claimed into the account and has an active Free plan.
- Porkbun DNS: `shortstack.lawrenceamlangomes.com` is a CNAME to `shortstack-lawrence.onrender.com`. Render has verified the custom domain and issued TLS. `BASE_URL` is set to the public URL in Render and `render.yaml`.

No old Coolify data was imported. The fresh Neon application tables were empty after the live proof run. The new service, database, and Redis are all on Free plans; no payment card was entered for this migration.

## Verification (2026-10-09)

- Render deploy `dep-db4ieu2d0e5s73cfh88g` went live; the `BASE_URL` env update deploy `dep-db4ihp2j9qps73cm7b60` also went live.
- Production server and client builds and Render Blueprint validation passed.
- At the Render URL: `/health`, React homepage, invalid URL rejection, anonymous link creation, Upstash cache hit, redirect, BullMQ click write to Neon, register, login, refresh rotation, and reused-token rejection passed.
- At the custom domain: valid HTTPS, `/health`, homepage, short-link response using the custom hostname, redirect, and BullMQ click count passed. After the old DNS cache expired, ordinary DNS resolution returned the Render IP and the homepage and health route returned 200 without overrides. Proof links, clicks, users, tokens, and cache keys were deleted after testing.

## Shared agent access

The co-founder role may run in Codex or Claude Code on this Mac. Render CLI and Neon CLI are authenticated for the local user; GitHub CLI can push this repository. Both Codex and Claude Code have authenticated Upstash MCP access. Both have Porkbun's `no-purchases` MCP endpoint configured; its OAuth credentials are in the shared local `mcp-remote` store. Porkbun DNS access cannot buy or charge anything through this endpoint. Upstash CLI is installed, but its separate email/API-key login is unnecessary for normal MCP work.

Use `render services`, `neon projects list`, the configured Upstash MCP server, and the Porkbun MCP server for future operations. Keep `DATABASE_URL`, `REDIS_URL`, JWT secrets, and provider credentials out of this repository and chat messages. The Render service was created through the CLI with its environment variables set in Render; `render.yaml` records the intended Free configuration but is not linked as a Blueprint. The service uses a public Git repository URL, so Render does not auto-deploy commits even though its setting says `commit`. After pushing application changes, deploy the exact commit with `render deploys create srv-db4iet2d0e5s73cfh5p0 --commit <SHA> --wait --confirm`. Connecting a Git provider to Render would enable native auto-deploys later.

## Free-plan limits and domain

Render Free sleeps after idle time and has monthly quotas. Neon and Upstash have Free usage limits; BullMQ idle polling consumes Redis commands. The existing Porkbun domain is already registered through **2027-01-15** with auto-renew off. Keeping the same custom domain past that date requires renewal, so the custom URL cannot be guaranteed at $0 indefinitely.
