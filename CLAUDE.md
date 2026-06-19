# ShortStack

## What this project is

URL shortener with click analytics. Built to learn elite backend engineering: Express → PostgreSQL → Docker → Redis → BullMQ → Nginx → Kafka → CDN → load balancing → VPS deploy.

## Current Phase

**Session 1 complete** — Express server running with TypeScript. In-memory link store. Basic routes working.

## Architecture

- **Runtime:** Node.js + TypeScript
- **Framework:** Express 5
- **Entry:** `src/index.ts` → `src/app.ts`
- **Routes:** `src/routes/links.ts` — POST `/api/links`, GET `/api/links/:slug`
- **Middleware:** `src/middleware/errorHandler.ts`
- **Storage:** In-memory (temporary — PostgreSQL next)

## Key Decisions Log

| Decision | Rationale | Date |
|---|---|---|
| Express over NestJS | Learn raw HTTP layer first, no magic | 2026-06-19 |
| Express 5 | Current stable version | 2026-06-19 |
| Split app.ts / index.ts | Separation of app config vs server boot — enables testing without port binding | 2026-06-19 |

## Skills

| Skill | Trigger | Purpose |
|---|---|---|
| `skills/skill_coFounder.md` | `@skill_coFounder.md` | Co-founder + senior mentor. Reads session state, briefs on progress, teaches while building. Say `End Today` to save session and update this file. |
| `skills/skill_gitAddCommitPush.md` | `@skills/skill_gitAddCommitPush.md` | Run build check, fix errors, commit, push to main. |

## Do Not Touch

*(Populated as the project grows — frozen decisions, dangerous files, off-limits areas.)*
