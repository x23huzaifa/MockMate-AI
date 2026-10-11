# PROJECT_AUDIT.md — MockMate AI

Date: 2026-10-11. Phase 0 (scaffold).

## 1. Repository inspection

This is a **greenfield project**: the target directory did not exist before this
scaffold. There is no existing code, no legacy framework, no database, and no
prior features to preserve, migrate, or work around. Every decision below is
made fresh, with reasons recorded so future phases don't re-litigate them.

## 2. Stack decisions (with reasons)

### Client: React 19 + Vite + TypeScript + react-router-dom (`client/`)

- React 19: current stable major, team already productive with it.
- Vite: instant dev server, simple build, first-class TypeScript support.
- TypeScript in strict mode: catches contract errors between client and API
  at build time instead of in the browser.
- react-router-dom: declarative routing for the planned page set
  (landing, auth, dashboard, interview room, results, history, admin).

### Server: Express + versioned REST API (`/api/v1/...`), run with tsx (`server/`)

- Chosen **over tRPC** deliberately: explicit REST contracts are simpler to
  reason about, trivially testable with curl, and easier to defend in a viva
  ("here is the route, here is the handler, here is the test").
- Express 5: stable, minimal, enormous ecosystem.
- tsx: runs TypeScript directly in dev with watch mode; no separate compile
  step while iterating.
- Versioned prefix (`/api/v1`) from day one so future breaking changes don't
  strand clients.

### Database: Drizzle ORM + mysql2 (`drizzle/`), database `interview_saathi`

- Drizzle: type-safe SQL without a heavy ORM; migrations are explicit files.
- mysql2: the standard MySQL driver for Node.
- **Separate database** (`interview_saathi`): this project must never share a
  database, table, or credential with any other project.

### Single dev port: 3100

- Express serves the API **and** the client (Vite as middleware in dev,
  static `dist/` in production). One port means no CORS configuration, no
  proxy rules, and no "frontend can't reach backend" debugging.
- Port 3100 chosen to avoid clashing with other local projects.

### Package manager: pnpm

- Fast, disk-efficient, strict dependency resolution.

### Supporting decisions

- `@types/node`, `@types/express`, `@types/react`, `@types/react-dom` are in
  devDependencies: `pnpm check` (`tsc --noEmit`) cannot pass without them.
- No `cross-env`: `NODE_ENV` defaults to `"development"` inside
  `server/_core/env.ts`, so `pnpm dev` is a plain cross-platform command.
- Build outputs are split: client → `dist/` (public), server → `dist-server/`
  (private). The server bundle is never inside the publicly served directory.
- `tsconfig.server.json` (NodeNext) exists only so `pnpm build` produces a
  real runnable server; `tsconfig.json` (bundler) is what `pnpm check` uses.

## 3. Critical engineering rule (non-negotiable)

**`server/_core/env.ts` validates every required environment variable at
startup and throws a CLEAR error naming the missing variable.**

Rationale: a sibling project once shipped
`cookieSecret: process.env.JWT_SECRET ?? ""`. The empty-string fallback meant
the server started fine, then every session sign/verify failed with the cryptic
error `DataError: Zero-length key is not supported` — no user could log in,
and the root cause (an unset secret) was invisible. Fail-fast validation with
a named variable would have surfaced it in one second.

Consequences:
- `DATABASE_URL` (required), `JWT_SECRET` (required, ≥ 32 chars).
- Any future secret follows the same `required()` helper. No exceptions.

## 4. v1 non-goals (explicit, to prevent scope creep)

- No paid LLM API keys required: v1 ships a **local template-based question
  engine** behind a provider interface. The interface allows a real LLM
  provider later; the template engine is honestly labeled, never "fake AI".
- No payment/subscription system.
- No email delivery (verification links, notifications) until a provider is
  configured; account flows must work without it.
- No mobile apps; responsive web only.
- No production deployment in Phase 0 (deployment docs arrive in Phase G).

## 5. Known constraints

- No paid LLM keys are available. Therefore: question generation and answer
  evaluation in early phases use deterministic local logic (templates +
  rubrics), clearly labeled as such in UI and docs. A provider abstraction
  (`server/ai/`) will be introduced in Phase C so a real model can replace the
  local engine without rewriting call sites.
- Voice features depend on browser/provider capabilities; text mode is always
  the guaranteed fallback (Phase E documents honest limits).
- Multilingual quality (Urdu script, Roman Urdu, code-switching) will be
  validated against a documented test corpus, not claimed on faith.

## 6. Audit outcome

Greenfield confirmed. Stack locked per §2. Env-validation rule in force per §3.
Proceed to `IMPLEMENTATION_PLAN.md` Phase A.
