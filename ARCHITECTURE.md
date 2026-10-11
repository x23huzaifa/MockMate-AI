# ARCHITECTURE.md — MockMate AI

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
  `/api/v1/auth/register`, `/api/v1/interviews`).
- JSON everywhere. Success shapes are flat and per-resource: `{ user }`,
  `{ cv }`, `{ cvs }`, `{ session, questions }`, `{ overview }`,
  `{ ok: true }`. Failure: `{ error: "<human-readable>" }` with the
  correct HTTP status code. (An early draft of this doc described a generic
  `{ ok, data }` envelope — that was never implemented; the flat shapes
  above are what the code actually returns.)
- Unknown `/api/*` routes return JSON 404 — API consumers never get HTML.
- All state-changing routes require authentication; public-by-design
  exceptions are register/login/logout, health, and contact-POST.
  Authorization (ownership + role checks) is enforced server-side, never
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

MockMate AI is a **fully independent project**:

- Own repository, own database (`interview_saathi`), own APIs, own
  credentials.
- **Zero shared code** with any other project. Do not copy modules,
  schemas, or auth logic between projects; reimplement deliberately when
  a pattern is genuinely reusable, and document the decision.
- A bug or schema change in another project must never affect this one.

## Interview state machine (Phase C)

`server/lib/interviewState.ts` is the single source of truth for session
status transitions. Routes call `assertTransition(from, to)` before
persisting; an illegal move throws `StateError` and the route returns 409.
`status` is a plain varchar in the DB on purpose — the machine, not the
schema, owns the rules.

```
created → asking → awaiting_answer → evaluating → awaiting_answer …
   │          (start)      │ answer          │ next Q      ↘ (last Q)
   │                       │ submitted       │             completed
   └→ paused ←─────────────┘                 └→ paused
   └→ interrupted / failed (from any state; terminal)
paused → awaiting_answer (resume, re-presents the current question)
completed / interrupted / failed → (terminal, no outgoing moves)
```

`asking` and `evaluating` are transient: the answer endpoint moves
`awaiting_answer → evaluating`, runs the evaluator, then advances to
`awaiting_answer` (next question, `currentQuestionIndex + 1`) or
`completed`. If evaluation itself throws, the session is marked `failed`
rather than left half-evaluated.

## AI provider abstraction (Phase C)

```
server/routes/interviews.ts
   │  depends only on interfaces
   ▼
server/ai/types.ts          ← QuestionProvider, AnswerEvaluator
   ▲
   │  implements
server/ai/index.ts          ← wires the v1 implementation
   ▼
server/ai/templateProvider.ts  ← deterministic bank + rubric heuristic
```

v1 is deliberately NOT a language model: 40 hand-written English questions
across introduction/technical/behavioral/situational, plus 10 hand-written
Urdu-script and 10 hand-written Roman-Urdu questions (introduction +
behavioral only — exact counts asserted in tests), selected by a seeded
(FNV-1a + mulberry32) deterministic algorithm — the same input always
yields the same questions, no randomness. Evaluation is a transparent
heuristic (keyword overlap → relevance; word-count bands + example
signals → depth; sentence shape → clarity; structure markers → structure;
each 1–5, overall = mean). Both the UI ("Template-based questions (beta)")
and every report ("not human judgment") label this honestly. Swapping in
a real LLM later means implementing the two interfaces and changing
`server/ai/index.ts` — no route changes.

## Language settings flow (Phase D)

```
user picks defaults               per-interview overrides
        │                                    │
        ▼                                    ▼
GET/PUT /api/v1/settings/languages    POST /api/v1/interviews { interviewLanguage,
   │                                   responseLanguage, feedbackLanguage,
   │                                   evaluationLanguage } (validated against
   │                                   per-setting allowlists in
   ▼                                   server/lib/languages.ts)
user_language_settings (1 row/user) ──copied at creation──▶ interview_sessions
                                                              │      │      │
                              ┌───────────────────────────────┘      │      └──────────────────────────────┐
                              ▼                                      ▼                                     ▼
                    questionProvider picks                answerEvaluator picks                answerEvaluator picks
                    the bank (ur/roman-ur →               feedback templates                   stopwords + keyword
                    localized intro/behavioral;            (en fallback is logged,               translations for
                    technical stays English)              never silent)                        relevance scoring
```

Key rules: the four settings are independent (Urdu questions + English
feedback is legal); answers are stored verbatim in `interview_answers`
regardless of language; tokenization is Unicode-aware (`\p{L}`) with
per-language stopwords so non-Latin answers are never silently penalized;
code-switched answers match keywords on both sides. The UI offers only
what exists — see `LANGUAGE_SUPPORT.md` for the earned support levels.

## Voice layer (Phase E)

```
InterviewRunner (React)
   │  🔊 Listen                    🎤 Speak answer
   ▼                               ▼
speak(text, interviewLanguage)   createRecognizer(responseLanguage, callbacks)
   │                               │  interim → "Hearing: …" preview
   │                               │  final   → appended into the SAME editable textarea
   ▼                               ▼
client/src/lib/voice.ts — the ONLY voice module. No server routes, no DB
tables, no npm dependencies: it wraps the browser's Web Speech API.
```

Key rules: voice is an **enhancement layer** — the text interview works
identically with voice unavailable (Firefox proves it). Capabilities are
feature-detected (`getVoiceCapabilities()`); `getBestVoice()` returns null
rather than substituting an English voice for Urdu, and the UI says so
plainly. Every failure is a typed `VoiceError` (`no-tts`,
`no-voice-for-lang`, `speak-interrupted`, `no-stt`, `mic-denied`,
`no-speech`, `stt-error`) with a plain-language message — nothing is
swallowed. The transcript is always editable before submit (required, not
optional). Language codes map to BCP-47 honestly: `roman-ur` → the `ur-PK`
model with a documented no-Roman-Urdu-model caveat shown in the UI. The
whole feature is labeled `experimental` until real-browser tested — see
`VOICE_SUPPORT.md` for the browser × language matrix.

## Data flow example (health check)

```
GET /api/v1/health
  → express.json() parses body
  → route handler returns { ok: true, service: "mockmate-ai" }
  → landing page fetches it on load and renders API status honestly
```

Future flows (auth, CV upload, interviews) follow the same shape:
route → validation → service module → Drizzle → MySQL, with errors mapped
to `{ ok: false, error }` and logged server-side without leaking secrets.

## RBAC + audit (Phase F)

```
POST /api/v1/auth/register
  → if ADMIN_EMAIL set and email matches (case-insensitive): role='admin'
  → audit_logs: auth.user.registered_as_admin

/api/v1/admin/*  → requireAdmin → requireAuth (401) → role === 'admin' (403)
/api/v1/admin/users          GET (paginated, safe columns — passwordHash never selected)
/api/v1/admin/users/:id/role PATCH {role} — guards: no self-demote, no last-admin demote
/api/v1/admin/sessions       GET (metadata ONLY — see privacy rule below)
/api/v1/admin/contact        GET / PATCH {status}
/api/v1/admin/audit          GET (newest first, ?action= filter)
```

Rules:

- **Admin bootstrap** is env-driven (`ADMIN_EMAIL`, optional, fail-fast
  validated). Unset → no admin exists → every admin route 401/403s.
- **Role freshness caveat:** the role travels in the signed JWT, so a role
  change takes effect on the affected user's next login. This is the
  deliberate tradeoff of stateless sessions, not a bug.
- **Audit trail:** every admin mutation writes `audit_logs`
  (actor/action/target/metadata) AFTER the action succeeds; failures
  propagate loudly rather than silently dropping the trail.
  `actorUserId` NULL = the system itself.
- **Privacy rule (hard):** `GET /api/v1/admin/sessions` returns session
  metadata only (id, user email, status, languages, answered count, mean
  score, dates). Answer transcripts, question text, and CV contents are
  never exposed to admins. Admins manage accounts — they don't read what
  users said.
- **Progress honesty:** `GET /api/v1/progress/overview` aggregates the
  caller's own rows via pure `server/lib/progress.ts`. Empty history →
  nulls (UI renders "—", never 0). No fabricated numbers anywhere.
- **Contact rate limit:** 5/hour per IP, in-memory Map in
  `server/lib/rateLimit.ts` — single-instance only (documented); a
  multi-instance deploy would need a shared store.
- **Auth rate limit (Phase G):** 10 attempts / 15 min / IP on
  `POST /api/v1/auth/login` and `/register` (`authLimiter`), 429 +
  `Retry-After`. Same single-instance caveat.
- **Security headers (Phase G):** `server/middleware/securityHeaders.ts`
  sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer` on every response. No helmet dependency.

Full route-by-route audit: `SECURITY.md`.
