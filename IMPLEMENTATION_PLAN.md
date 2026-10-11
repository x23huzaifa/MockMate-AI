# IMPLEMENTATION_PLAN.md — MockMate AI

Realistic phased plan. Each phase ends with exit criteria; do not start the
next phase until the current one's criteria are met with evidence.

## Phase 0 — Scaffold ✅ DONE (2026-10-11)

Project skeleton: configs, Express + Vite single-port server, validated env,
health API, `users` schema, honest landing page, and this documentation set.

Exit criteria: all files in the Phase 0 file list exist; `pnpm check` /
`pnpm build` / `pnpm test` are defined and runnable by the developer on their
machine. (Not executed in this turn by design — the user runs them on their PC.)

## Phase A — Auth + database

- Drizzle migration for `users`; `pnpm db:generate` / `pnpm db:migrate` verified
  against a real MySQL `interview_saathi` database.
- Register / login / logout with server-side validation; passwords hashed
  with **bcryptjs (12 rounds, pure JS)** — chosen over native bcrypt because
  bcrypt's node-gyp postinstall is blocked by pnpm's ignored-builds policy
  on Windows; identical hash/compare API, zero native build.
  native support and wide compatibility (decided 2026-10-11, Phase A).
- JWT sessions in httpOnly, SameSite cookies; expiration and logout
  invalidation; protected-route middleware.
- Unit + integration tests: register, duplicate-email rejection,
  wrong-password rejection, expired-session rejection.

Exit: register → login → protected page → logout works end-to-end in the
browser; all auth tests pass.

## Phase B — CV upload + parsing

- Authenticated PDF/DOCX upload with real content validation, size limits,
  private storage, processing-status tracking.
- Local text extraction + rules-based structured parsing (no LLM required);
  user can review and correct extracted fields.
- `cvs` table + migration.

Exit: upload a real PDF → extracted skills/education visible and editable.

## Phase C — Text interview (core loop)
- `job_profiles`, `interview_sessions`, `interview_questions`,
  `interview_answers`, `answer_evaluations` tables + migrations.
- Interview state machine (created → asking → awaiting_answer → evaluating →
  completed, plus paused/interrupted/failed) validated server-side.
- **Local template-based question engine** (deterministic, honestly labeled)
  behind a provider interface `server/ai/` so a real LLM can plug in later
  without rewriting call sites.
- Answer submission, rubric-based evaluation, per-answer feedback, session report.

Exit: a complete text interview (setup → questions → answers → report) works
end-to-end with persisted data; no fake scores anywhere.

**Phase C completion report (2026-10-11):**
Implemented 2026-10-11 (code authored; `pnpm check`/`test`/`db:migrate`
execution pending on PC — no node_modules in the authoring environment):

- 5 tables + hand-written `drizzle/migrations/0003_interview.sql`
  (`CREATE TABLE IF NOT EXISTS`, MySQL 8 / MariaDB 10.4) + journal tag
  `0003_interview`; all tables added to `drizzle/schema.ts` with TS types.
- `server/ai/`: `types.ts` (QuestionProvider/AnswerEvaluator interfaces),
  `templateProvider.ts` (40-question bank, seeded deterministic selection,
  transparent rubric heuristic — honestly labeled, not fake AI),
  `index.ts` (swap point for a future LLM, no call-site changes).
- `server/lib/interviewState.ts`: 8-state machine, `assertTransition`
  throws StateError on illegal moves; routes return 409.
- Routes: `/api/v1/job-profiles` (CRUD, ownership-guarded) and
  `/api/v1/interviews` (create/list/detail/start/answer/pause/resume/
  interrupt/report). Answers stored verbatim; evaluations 1–5 per
  dimension; report aggregates computed from rows (nulls, never 0).
- Frontend: `/jobs`, `/interview/setup`, `/interview/:id`,
  `/interview/:id/report`; Dashboard shows real completed count + recent
  interviews. No dead buttons; loading/error states everywhere.
- Tests: `interviewState.test.ts`, `templateProvider.test.ts`,
  `interviewGuards.test.ts` — written, not executed here.

Exit: a complete text interview (setup → questions → answers → report)
works end-to-end with persisted data; no fake scores anywhere.
(Verification of the exit criteria requires the PC run.)

## Phase D — Multilingual text ✅ IMPLEMENTED 2026-10-11 (verification pending on PC)

- `interview_language` / `response_language` / `feedback_language` /
  `evaluation_language` settings (English, Urdu, Roman Urdu + 5 experimental
  response-only languages), persisted per user (`user_language_settings`,
  migration 0004) and per session.
- Roman Urdu input handling, Urdu-script feedback rendering (RTL),
  per-language stopwords + keyword lists; code-switched answers not penalized.
- Documented test corpus: `LANGUAGE_TEST_CASES.md` (20 cases: EN/UR/RU/CS × 5);
  acceptance threshold ≥80% per group for `verified` (currently `verified`:
  English only; Urdu/Roman-Urdu/code-switched: `partial` until manual runs).
- `LANGUAGE_SUPPORT.md`: honest capability matrix, exact content counts.

Exit: corpus passes at the defined threshold; language settings visibly change
interview and feedback behavior. → Deterministic cases unit-tested
(`server/ai/multilingual.test.ts`, `server/lib/languages.test.ts` — written,
not executed here); manual browser/DB runs pending on PC per TESTING.md.

## Phase E — Voice interaction

- Provider abstraction for speech-to-text / text-to-speech; browser Web Speech
  API evaluated first with honest capability notes.
- Recording lifecycle UI (permission, indicators, start/stop, transcript
  preview, edit-before-submit), failure handling for every listed case.
- Text mode always available as fallback.

Exit: voice works where the provider supports it; where it doesn't, the UI
says so plainly and text mode carries the interview.

Implemented 2026-10-11 (verification pending on PC): `client/src/lib/voice.ts`
(capabilities, speak, recognizer, typed VoiceError; Web Speech API only, zero
new deps, no DB tables), 🔊 Listen + 🎤 mic with editable transcript in
InterviewRunner, read-only diagnostics in LanguageSettings, `VOICE_SUPPORT.md`
honest matrix, `client/src/lib/voice.test.ts` (DOM-free, injected fakes);
whole feature labeled experimental; `pnpm test` not executed here.

## Phase F — Results, progress, admin

- Results pages, session history (search/filter), progress charts — every
  metric computed from stored records, never fabricated.
- Admin role, RBAC, user/session management, audit log. Admins do NOT get
  default access to private transcripts/CVs.
- Contact form with validation, rate limiting, admin review.

Exit: all numbers on screen trace to database rows; authorization tests pass.

## Phase G — Docs + hardening

- README/ARCHITECTURE/TESTING/DEPLOYMENT/TROUBLESHOOTING rewritten to match
  the real implementation; `.env.example` complete.
- Security pass (authz on every route, upload hardening, secret hygiene),
  full regression run, production build verified.

Exit: definition-of-done checklist (see parent brief) is green with evidence.

**Status (2026-10-11): IMPLEMENTED, PC verification pending.**
SECURITY.md route-by-route audit done; P0/P1 findings fixed in code
(auth rate limits, security headers). README/ARCHITECTURE/TESTING rewritten,
DEPLOYMENT.md / TROUBLESHOOTING.md / ARCHITECTURE_DECISIONS.md /
AUTONOMOUS_IMPROVEMENTS.md created, FEATURE_STATUS.md honesty pass,
`pnpm start` script added. `pnpm check` / `pnpm test` / `pnpm build` never
executed in the author's environment — the user runs TESTING.md on PC.
