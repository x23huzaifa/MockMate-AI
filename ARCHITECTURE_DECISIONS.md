# ARCHITECTURE_DECISIONS.md — InterviewSaathi AI

Concise ADRs for the significant decisions. One paragraph each:
context → decision → consequences.

## ADR-1 — bcryptjs over bcrypt

**Context:** Phase A chose `bcrypt` for password hashing, but its native
node-gyp postinstall is blocked by pnpm's ignored-builds policy on the
Windows dev machine, so the binding was never compiled and both tests and
the server crashed (`bcrypt_lib.node` missing).
**Decision:** switched to `bcryptjs` (pure JS, identical hash/compare API,
12 salt rounds).
**Consequences:** zero native build, works everywhere pnpm installs; slower
per-hash than native bcrypt, irrelevant at this app's scale. Documented in
TROUBLESHOOTING.md #2.

## ADR-2 — Template provider behind the `server/ai/` abstraction

**Context:** v1 has no LLM budget or key, but the product needs real
questions and evaluations today, and a future LLM must not require
rewriting routes.
**Decision:** routes depend only on `QuestionProvider` / `AnswerEvaluator`
interfaces (`server/ai/types.ts`); v1 implements them with a deterministic
template bank + transparent rubric heuristic, honestly labeled
("Template-based questions (beta)", "not human judgment").
**Consequences:** swapping in a real LLM = implementing two interfaces +
changing `server/ai/index.ts`; no route changes. The honesty labels are a
permanent requirement, not v1 scaffolding.

## ADR-3 — Four separate language settings

**Context:** Pakistan-first users mix languages constantly (Roman Urdu
answers to Urdu questions, English feedback on Urdu interviews); a single
"language" setting can't express that.
**Decision:** `interviewLanguage` / `responseLanguage` / `feedbackLanguage` /
`evaluationLanguage`, persisted per user AND copied per session, each with
its own honest allowlist.
**Consequences:** more UI surface (four dropdowns), but every combination
the UI offers actually works; per-session copies freeze behavior against
later default edits. See LANGUAGE_SUPPORT.md.

## ADR-4 — Web Speech API over server STT/TTS

**Context:** voice interviews need speech-to-text and text-to-speech with
zero budget and zero new infrastructure.
**Decision:** client-only voice layer on the browser Web Speech API —
`client/src/lib/voice.ts` is the only voice module; no server routes, no
DB tables, no API keys. The whole feature is labeled experimental until
real-browser tested (VOICE_SUPPORT.md).
**Consequences:** capability varies by browser/OS (Firefox has no STT);
text mode is the guaranteed path and works identically. No vendor lock-in,
no cost, honest limits.

## ADR-5 — ADMIN_EMAIL bootstrap

**Context:** the app needs an admin without a seed script, a default
password, or a database console.
**Decision:** optional `ADMIN_EMAIL` env var; the user who registers with
that email becomes admin (audit-logged). Unset → no admin exists, admin
routes 401/403.
**Consequences:** no privileged default account; bootstrap is one env var
set before first registration. Rotation/removal is manual (role change via
the admin panel, guarded against self-demote and last-admin demote).

## ADR-6 — Client-side history filtering

**Context:** `/history` needs search + status/language filters; the server
list endpoint returns the user's sessions.
**Decision:** filtering happens client-side on the fetched lists; the
server stays a thin, honest list endpoint.
**Consequences:** simpler server, no query-param surface to validate; fine
at this scale (tens of sessions per user). Revisit with server-side
search if histories grow large.

## ADR-7 — Verbatim transcript storage

**Context:** answers arrive in mixed languages/scripts; any normalization
before storage would destroy evidence (and the language-honesty promise).
**Decision:** `interview_answers.answerText` stores the user's original
text byte-for-byte; all language handling (tokenization, stopwords,
keyword matching) happens at evaluation time.
**Consequences:** reports and re-evaluation always see the true input;
storage cost is trivial. Admins never see transcripts anyway (privacy
rule).
