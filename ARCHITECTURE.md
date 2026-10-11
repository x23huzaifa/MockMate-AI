# ARCHITECTURE.md — InterviewSaathi AI

## System diagram

```
                    ┌─────────────────────────────────┐
                    │  Browser                        │
                    │  React 19 SPA (client/src)      │
                    └───────────────┬─────────────────┘
                                    │  HTTP :3100
                    ┌───────────────▼─────────────────┐
                    │  Express (server/_core/index.ts)│
                    │                                 │
                    │  /api/v1/*  → REST handlers     │
                    │  /api/*     → JSON 404          │
                    │                                 │
                    │  dev:  Vite middleware (HMR)     │
                    │  prod: static dist/ + SPA index │
                    └───────────────┬─────────────────┘
                                    │  Drizzle ORM
                    ┌───────────────▼─────────────────┐
                    │  MySQL — database               │
                    │  `interview_saathi`             │
                    └─────────────────────────────────┘
```

Single port (3100) in both modes: no CORS, no dev proxy. In development,
Express mounts Vite as middleware so HMR works through the same origin.
In production (`NODE_ENV=production`), Express serves the prebuilt client
from `dist/`; the compiled server lives in `dist-server/` and is never
exposed as static content.

## REST conventions

- Versioned prefix: `/api/v1/<resource>` (e.g. `/api/v1/health`,
  future `/api/v1/auth/register`, `/api/v1/interviews`).
- JSON everywhere. Success: `{ ok: true, data: ... }`.
  Failure: `{ ok: false, error: "<human-readable>" }` with the correct HTTP
  status code.
- Unknown `/api/*` routes return JSON 404 — API consumers never get HTML.
- All state-changing routes require authentication (from Phase A on);
  authorization (ownership + role checks) is enforced server-side, never
  trusted from the client.

## Environment validation rule (critical)

`server/_core/env.ts` runs at startup and throws a **clear, named error**
for any missing/invalid required variable (`DATABASE_URL`, `JWT_SECRET`
≥ 32 chars). Rationale: a sibling project shipped
`process.env.JWT_SECRET ?? ""`; the empty secret made every session fail
with cryptic `DataError: Zero-length key is not supported` and nobody
could log in. This project fails fast in one second instead. No
empty-string fallbacks for secrets, ever.

## Separation rule (critical)

InterviewSaathi AI is a **fully independent project**:

- Own repository, own database (`interview_saathi`), own APIs, own
  credentials.
- **Zero shared code** with any other project. Do not copy modules,
  schemas, or auth logic between projects; reimplement deliberately when
  a pattern is genuinely reusable, and document the decision.
- A bug or schema change in another project must never affect this one.

## Data flow example (health check)

```
GET /api/v1/health
  → express.json() parses body
  → route handler returns { ok: true, service: "interview-saathi-ai" }
  → landing page fetches it on load and renders API status honestly
```

Future flows (auth, CV upload, interviews) follow the same shape:
route → validation → service module → Drizzle → MySQL, with errors mapped
to `{ ok: false, error }` and logged server-side without leaking secrets.
