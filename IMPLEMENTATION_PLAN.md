# IMPLEMENTATION_PLAN.md — InterviewSaathi AI

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
  (scrypt or argon2 — decide in-phase, document why).
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

## Phase D — Multilingual text

- `interview_language` / `feedback_language` settings (English, Urdu,
  Roman Urdu), persisted per user and per session.
- Roman Urdu input handling, Urdu-script feedback rendering (RTL),
  language-coach corrections.
- Documented test corpus: English, Urdu script, Roman Urdu, code-switched
  inputs; acceptance threshold defined before testing.

Exit: corpus passes at the defined threshold; language settings visibly change
interview and feedback behavior.

## Phase E — Voice interaction

- Provider abstraction for speech-to-text / text-to-speech; browser Web Speech
  API evaluated first with honest capability notes.
- Recording lifecycle UI (permission, indicators, start/stop, transcript
  preview, edit-before-submit), failure handling for every listed case.
- Text mode always available as fallback.

Exit: voice works where the provider supports it; where it doesn't, the UI
says so plainly and text mode carries the interview.

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
