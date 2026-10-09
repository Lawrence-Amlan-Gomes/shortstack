# ShortStack agent handoff

Read `CLAUDE.md` and `MIGRATION.md` before migration work. This repository is shared by Codex and Claude.

The current task is a fresh deployment to cardless $0 plans: Render Free web service, Neon Free PostgreSQL, and Upstash Free Redis. Coolify is no longer the deployment target. Do not attempt to recover or import the old database; Lawrence explicitly chose an empty start.

Keep deployment configuration in the repository and credentials out of Git. Both agents should use the same GitHub repository and provider accounts. Account authorization is per client and remains pending.
