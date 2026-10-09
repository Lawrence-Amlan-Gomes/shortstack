# ShortStack agent handoff

Read `CLAUDE.md` and `MIGRATION.md` before migration work. This repository is shared by Codex and Claude.

The co-founder role defined in `skill_coFounder.md` applies in either client. A future Claude Code session and a future Codex session must inherit the same project decisions and handoff state.

The current task is a fresh deployment to cardless $0 plans: Render Free web service, Neon Free PostgreSQL, and Upstash Free Redis. Coolify is no longer the deployment target. Do not attempt to recover or import the old database; Lawrence explicitly chose an empty start.

Keep deployment configuration in the repository and credentials out of Git. Both agents should use the same GitHub repository and provider accounts. A chat plugin connection is client-specific; prefer a provider CLI login in the shared local user account where supported, or authorize each MCP client separately. Record which access path actually works before relying on it.
