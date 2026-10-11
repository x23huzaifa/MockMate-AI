# TESTING.md — MockMate AI

The single ordered verification script. Run top to bottom on the dev PC
(Windows + XAMPP MySQL). **Honest status: unit tests were written in an
environment without `node_modules` — `pnpm test` / `pnpm check` /
`pnpm build` have never been executed by the author.** Run them; nothing
below counts as "passed" until it actually runs green on your machine.

## Step 0 — prerequisites

- Node 20+, pnpm, XAMPP MySQL running.
- `.env` exists with `DATABASE_URL` and `JWT_SECRET` (≥ 32 chars).
- Database created:
  `CREATE DATABASE interview_saathi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`

## Step 1 — install

```powershell
pnpm install
```

Expect the `ERR_PNPM_IGNORED_BUILDS` notice (esbuild scripts are skipped —
harmless; see TROUBLESHOOTING.md). All deps are pure-JS; no native build
is required.

## Step 2 — migrate (0001 → 0005)

```powershell
pnpm db:migrate
```

Applies `drizzle/migrations/0001_init` (users) → `0002_cvs` → `0003_interview`
→ `0004_languages` → `0005_admin`. Migrations are hand-written and
idempotent (`IF NOT EXISTS`); re-running on an already-migrated DB must not
error. Verify: `DESCRIBE interview_saathi.users;` etc. show the tables.

## Step 3 — typecheck

```powershell
pnpm check
```

`tsc --noEmit` — must pass with **zero errors**.

## Step 4 — unit tests

```powershell
pnpm test
```

Covers (no DB needed): bcryptjs round-trip, jose sign/verify, auth
validators, CV magic-byte detection + parser fixtures (EN + Roman-Urdu),
correction validators, interview state machine, template provider
(determinism, scoring bands), interview guards (no IDOR), language
registry + multilingual banks (exact counts), requireAdmin, admin guards,
progress aggregation, rate limiter (contact 5/hour + auth 10/15min +
Retry-After math), voice capability detection. **Every test must pass.**

## Step 5 — dev server

```powershell
pnpm dev
# → http://localhost:3100
```

Fail-fast check: with no `.env`, the server must crash in ~1s naming the
missing variable (`[env] Missing or invalid environment variable: ...`) —
that is the validation working, not a bug.

## Step 6 — manual API checklists (needs Steps 1–5)

### Auth
1. `POST /api/v1/auth/register` valid → **201** `{ user }` + `mockmate_session` httpOnly cookie.
2. Same email → **409** "Email already registered."
3. Short password → **400** with message.
4. `POST /login` wrong password → **401** "Invalid email or password." (generic — no enumeration).
5. Correct → **200** + cookie. `GET /me` → **200**; without cookie → **401**.
6. `POST /logout` → **200**; `/me` → **401** after.
7. 11 rapid logins → **429** with `Retry-After` header.
8. Browser: `/register` → `/dashboard`; logged-out `/dashboard` → `/login`.

### CVs
1. `POST /api/v1/cvs` real PDF (< 5 MB, field `cv`) → **201** `status: "ready"`; `storedPath` absent.
2. `.txt` renamed to `.pdf` → **400** (magic bytes decide).
3. > 5 MB → **413**. No file → **400**. Logged out → **401**.
4. `GET /:id` of another user's id → **404** "CV not found." (identical — no IDOR).
5. `PATCH /:id` `{ "skills": ["Go"] }` → **200**; unknown field → **400**.
6. `DELETE /:id` → **200**; file gone from `server/uploads/cvs/<userId>/`.
7. Browser `/cvs`: upload → badge → detail → correct → save → delete.

### Interviews
1. `POST /api/v1/job-profiles` `{ "title": "Frontend Developer" }` → **201**; empty title → **400**.
2. `POST /api/v1/interviews` `{ "questionCount": 5 }` → **201** `status: "created"`, 5 questions, first is `introduction`.
3. Another user's `jobProfileId` → **404**. `questionCount: 99` → **400**.
4. `POST /:id/start` → **200** `awaiting_answer` + Q1; again → **409**.
5. `POST /:id/answer` real paragraph → **200** `{ evaluation, nextQuestion }`; index advances.
6. Empty text → **400**. Last question → `{ completed: true }`, status `completed`.
7. Answer on completed → **409**. Pause → **200** `paused`; resume → `awaiting_answer` same question.
8. `GET /:id/report` → **200**; means match per-question scores; unanswered show nulls (never 0).
9. Another user's session id → **404** identical message.
10. Browser: `/interview/setup` → runner (category badge, "Question 1 of 5", "Template-based questions (beta)") → report → dashboard counts update.

### Languages
1. `GET /api/v1/settings/languages` → **200** `{ settings, catalog, explanations, allowed }`; only `en` is `verified`.
2. `PUT` `{ "interviewLanguage": "ur", "feedbackLanguage": "ur" }` → **200**; `{ "interviewLanguage": "ps" }` → **400**; `{}` → **400**.
3. `POST /api/v1/interviews` `{ "interviewLanguage": "ur", ... }` → **201**; Q1 is Urdu-script.
4. Full Urdu session: Urdu answers → Urdu `feedbackText`; report renders RTL.
5. Browser `/settings/languages`: four dropdowns with support badges; save → "Saved."; setup pre-fills defaults.
6. Run the 20 cases in `LANGUAGE_TEST_CASES.md`; record pass/fail. Until ≥4/5 pass per group, that group stays `partial` in `LANGUAGE_SUPPORT.md`.

### Voice (manual — real browser)
Unit tests cover detection/mapping; the rest needs eyes and ears. Record in `VOICE_SUPPORT.md`.
1. **Chrome:** 🔊 reads question; ⏹ stops. 🎤 → "Listening…" → interim "Hearing: …" → final lands in editable textarea → edit → submit.
2. Mic blocked → plain message; typing still works.
3. **Firefox:** 🎤 → "not supported in this browser"; diagnostics show STT ✗.
4. Urdu session, no Urdu voice → "No Urdu voice installed" (never English reading Urdu).
5. Silent mic → "Didn't hear anything — try again, or type."
6. Firefox full text interview works identically (fallback parity).

### Progress / history / admin / contact
1. New user: `/progress` empty state; overview returns zeros + nulls.
2. Complete one interview: `completedSessions: 1`, non-null averages, 1-point trend; cross-check against the report.
3. `/history`: search + status/language filters; completed rows link to reports.
4. `ADMIN_EMAIL` unset: register → `"user"`; `GET /api/v1/admin/users` → **401** logged out, **403** as user.
5. Set `ADMIN_EMAIL`, restart, register → `"admin"`; dashboard shows Admin link; `audit_logs` has the bootstrap row.
6. `/admin` as non-admin → "Not authorized" (no redirect loop).
7. Demote self → **400**; demote last admin → **400**; promote → **200** + audit row.
8. `GET /api/v1/admin/sessions` JSON: no `answerText`, no question text, no CV paths. `GET /users`: no `passwordHash`.
9. Logged out `POST /api/v1/contact` valid → **201**; 6th in an hour → **429**; bad email → **400**.
10. Admin Contact tab: review → status changes + audit row.

## Step 7 — production build

```powershell
pnpm build
```

Client → `dist/`; server → `dist-server/`. Must complete with zero errors.
Then `NODE_ENV=production` in `.env` and `pnpm start` (see DEPLOYMENT.md).

## Regression rule

After every fix: re-run the failing check, then the full sequence
(`pnpm check` + `pnpm test`). Never mark anything "passed" without
executing it. The standard is IMPLEMENTED → TESTED → FIXED → RETESTED →
REGRESSION TESTED.
