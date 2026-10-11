# InterviewSaathi AI

**Practice Smarter. Speak Confidently. Get Hired.**

AI-powered multilingual (English / Urdu / Roman Urdu) mock interview practice platform.

> **Status: Phase 0 — scaffold.** The project skeleton, validated environment
> handling, health API, and honest landing page are in place. Interview
> features are planned (see `IMPLEMENTATION_PLAN.md`) and not yet built.
> Nothing here is simulated: the landing page only shows what actually works.

## Stack

| Layer  | Choice                                  |
| ------ | --------------------------------------- |
| Client | React 19 + Vite + TypeScript + react-router-dom |
| Server | Express + versioned REST API (`/api/v1/...`), run with tsx |
| DB     | Drizzle ORM + mysql2 (database: `interview_saathi`) |
| Dev    | Single port **3100** (Express serves API + Vite middleware) |
| Tests  | Vitest (`pnpm test`) |

See `PROJECT_AUDIT.md` for why each choice was made.

## Setup

```bash
pnpm install
cp .env.example .env
# edit .env: set DATABASE_URL and generate a JWT_SECRET (see .env.example)
```

Create the database:

```sql
CREATE DATABASE interview_saathi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Generate migrations and apply them:

```bash
pnpm db:generate
pnpm db:migrate
```

Run the app:

```bash
pnpm dev
# → http://localhost:3100
```

Other commands: `pnpm check` (typecheck), `pnpm test` (unit tests),
`pnpm build` (client → `dist/`, server → `dist-server/`).

## Project rules

1. **This project is fully independent.** Separate repository, separate
   database (`interview_saathi`), separate APIs. No code, schema, or
   credentials are shared with any other project. Do not copy code between
   projects.
2. **Env validation is mandatory.** `server/_core/env.ts` validates every
   required variable at startup with a clear error naming the variable.
   Never use silent empty-string fallbacks (`process.env.X ?? ""`) for secrets.
3. **Never simulate.** Every button, route, and API must do real work or be
   honestly labeled "coming soon". No fake AI, no hardcoded demo results.
4. **IMPLEMENTED → TESTED → FIXED → RETESTED → REGRESSION TESTED.** A feature
   is done only when the full loop is complete, with evidence.
5. **Legal-only by design.** User-provided answers, AI-generated or built-in
   question banks. No third-party data collection or scraping of any kind.

## Docs

- `PROJECT_AUDIT.md` — greenfield audit + stack decisions with reasons
- `IMPLEMENTATION_PLAN.md` — phased build plan with exit criteria
- `FEATURE_STATUS.md` — feature tracker
- `ARCHITECTURE.md` — system diagram, REST conventions, key rules
