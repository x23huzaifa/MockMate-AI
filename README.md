# MockMate AI

**Practice Smarter. Speak Confidently. Get Hired.**

AI-powered multilingual (English / Urdu / Roman Urdu) mock interview practice
platform. Upload your CV, pick a target role, run full mock interviews with
structured feedback, and track progress — all from your own data.

> **Status: all planned phases complete (0–G).** Implemented, not yet
> PC-verified — see `TESTING.md` for the verification script and
> `FEATURE_STATUS.md` for the honest per-feature status. Nothing here is
> simulated: every number on screen is computed from stored rows, and every
> capability claim links to its evidence (`LANGUAGE_SUPPORT.md`,
> `VOICE_SUPPORT.md`).

## What it does

- **Auth** — register / login / logout with bcryptjs-hashed passwords and
  jose HS256 JWT sessions in httpOnly cookies.
- **CVs** — PDF/DOCX upload (magic-byte checked, 5 MB cap), rules-based
  parsing (skills, education, experience) with honest confidence labels,
  review-and-correct UI.
- **Job profiles** — target roles with required skills; interviews
  optionally reference one.
- **Text interviews** — setup → state-machine-driven Q&A (pause / resume /
  end early) → per-answer feedback → session report. Questions come from a
  deterministic local template bank, honestly labeled "Template-based
  questions (beta)"; a provider interface (`server/ai/`) lets a real LLM
  plug in later.
- **Multilingual** — four separate settings (interview / response /
  feedback / evaluation language), Urdu-script + Roman-Urdu question banks
  and feedback templates, RTL rendering, code-switch-tolerant scoring.
- **Voice (experimental)** — browser Web Speech API only: listen per
  question + mic dictation with editable transcript. Text always works.
- **Progress & history** — aggregates from your stored rows (nulls, never
  fabricated), hand-rolled SVG charts, searchable session history.
- **Admin** — RBAC, user management, session metadata (never transcripts),
  contact-message review, audit log. Bootstrapped via `ADMIN_EMAIL`.
- **Contact** — public form, validated, rate-limited.

## Stack

| Layer  | Choice |
| ------ | ------ |
| Client | React 19 + Vite + TypeScript + react-router-dom |
| Server | Express 5 + versioned REST API (`/api/v1/...`) |
| DB     | Drizzle ORM + mysql2 (`interview_saathi`), hand-written migrations |
| Auth   | bcryptjs (12 rounds) + jose HS256, httpOnly `SameSite=lax` cookies |
| Dev    | Single port **3100** (Express serves API + Vite middleware) |
| Tests  | Vitest (`pnpm test`) — pure-JS deps only, zero native builds |

See `ARCHITECTURE.md` for the system diagram and key rules, `SECURITY.md`
for the route-by-route audit.

## Setup (Windows / XAMPP)

```powershell
pnpm install
```

Copy `.env.example` to `.env` and set real values (see `.env.example` —
`DATABASE_URL`, `JWT_SECRET` ≥ 32 chars; optional `ADMIN_EMAIL`, `PORT`,
`NODE_ENV`).

Create the database:

```powershell
& "C:\xampp\mysql\bin\mysql.exe" -u root -e "CREATE DATABASE IF NOT EXISTS interview_saathi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Apply the migrations (0001 users → 0002 cvs → 0003 interview →
0004 languages → 0005 admin):

```powershell
pnpm db:migrate
```

Verify and run:

```powershell
pnpm check
pnpm test
pnpm dev
# → http://localhost:3100
```

Full verification script (unit + manual checklists per phase): `TESTING.md`.
Production run: `DEPLOYMENT.md`. Something broken? `TROUBLESHOOTING.md`.

## API

All responses are flat JSON: success → `{ user }` / `{ cv }` / `{ ok: true }`
etc.; errors → `{ error: "<message>" }` with the correct HTTP status.
`401` = not signed in, `403` = not admin, `404` = not found (identical for
missing vs someone else's — no IDOR leak), `409` = illegal state move,
`413` = file too large, `429` = rate-limited (with `Retry-After`).

| Router | Endpoints |
| ------ | --------- |
| Auth | `POST /api/v1/auth/register` (201) · `POST /login` (200) · `POST /logout` · `GET /me` — login/register rate-limited 10/15 min/IP |
| CVs (auth) | `POST /api/v1/cvs` (multipart `cv`, ≤ 5 MB) · `GET /` · `GET /:id` · `PATCH /:id` · `DELETE /:id` |
| Job profiles (auth) | `POST /` · `GET /` · `GET /:id` · `PATCH /:id` · `DELETE /:id` |
| Interviews (auth) | `POST /` (create + generate) · `GET /` (`?status=`) · `GET /:id` · `POST /:id/start` · `POST /:id/answer` · `POST /:id/pause` · `POST /:id/resume` · `POST /:id/interrupt` · `GET /:id/report` |
| Settings (auth) | `GET /api/v1/settings/languages` · `PUT /api/v1/settings/languages` |
| Progress (auth) | `GET /api/v1/progress/overview` |
| Contact (public) | `POST /api/v1/contact` — 5/hour/IP rate limit |
| Admin (admin) | `GET /users` · `PATCH /users/:id/role` · `GET /sessions` (metadata only) · `GET /contact` · `PATCH /contact/:id` · `GET /audit` — all paginated, mutations audit-logged |

### Becoming admin (`ADMIN_EMAIL`)

Optional env var. When set **before the first registration**, the user who
registers with that email (case-insensitive) gets `role='admin'` (recorded
in `audit_logs`). When unset, no admin exists and `/api/v1/admin` 401/403s.
The dashboard shows the Admin panel link only for admins. Note: the role
travels in the signed JWT, so a role change takes effect on the affected
user's next login (deliberate stateless-session tradeoff).

## Language & voice honesty

- **Languages:** four independent settings — `interviewLanguage` (question
  bank), `responseLanguage` (what you answer in, never enforced),
  `feedbackLanguage` (feedback text), `evaluationLanguage` (scoring
  keywords). Interview/feedback/evaluation accept `en`, `ur`, `roman-ur`;
  response accepts all 8 codes. What is verified vs partial vs experimental
  is stated in [`LANGUAGE_SUPPORT.md`](LANGUAGE_SUPPORT.md) — never claimed
  from a few LLM sentences.
- **Voice:** browser Web Speech API only, zero services/keys. Labeled
  **experimental** until real-browser tested; the matrix is in
  [`VOICE_SUPPORT.md`](VOICE_SUPPORT.md). Text mode always works identically.

## Project rules

1. **Fully independent.** Separate repository, database (`interview_saathi`),
   APIs. Zero shared code with any other project.
2. **Env validation is mandatory.** `server/_core/env.ts` fails fast with a
   named error. Never `process.env.X ?? ""` for secrets.
3. **Never simulate.** Every button and route does real work or is honestly
   labeled. No fake AI, no hardcoded demo results.
4. **IMPLEMENTED → TESTED → FIXED → RETESTED → REGRESSION TESTED** — with
   evidence, or it isn't done.
5. **Legal-only by design.** User-provided answers, built-in question banks.
   No third-party data collection or scraping.

## Docs

- `ARCHITECTURE.md` — system diagram, REST conventions, state machine, AI/voice/admin design
- `ARCHITECTURE_DECISIONS.md` — ADRs for the significant decisions
- `SECURITY.md` — route-by-route security audit + findings
- `TESTING.md` — the one ordered PC verification script
- `DEPLOYMENT.md` — production notes (build + start)
- `TROUBLESHOOTING.md` — real issues hit during the build, symptom → cause → fix
- `LANGUAGE_SUPPORT.md` / `LANGUAGE_TEST_CASES.md` — honest language matrix + corpus
- `VOICE_SUPPORT.md` — honest voice matrix
- `FEATURE_STATUS.md` — per-feature status (honest)
- `AUTONOMOUS_IMPROVEMENTS.md` — improvement log under the autonomous mandate
- `IMPLEMENTATION_PLAN.md` / `PROJECT_AUDIT.md` — build history
