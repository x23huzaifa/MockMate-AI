# AUTONOMOUS_IMPROVEMENTS.md — InterviewSaathi AI

Worthwhile improvements made under the autonomous mandate (beyond the
phase specs), with P0–P3 labels. P0 = security/data/core-flow failure;
P1 = core product; P2 = high-value enhancement; P3 = polish/optional.

## P0

- **Auth brute-force rate limiting** (Phase G): login/register had no
  limiter. Added `authLimiter` (10 attempts / 15 min / IP, 429 +
  `Retry-After`) via a `createRateLimiter` factory; contact limiter kept
  backward-compatible. With unit tests.
- **Security headers** (Phase G): `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` on every
  response — no new dependency (helmet declined per zero-new-deps rule).

## P1

- **bcrypt → bcryptjs** (Phase A verification): native build blocked by
  pnpm ignored-builds; switched to pure JS rather than fighting node-gyp.
- **`mode: "default"` on drizzle()** (Phase A verification): required by
  drizzle-orm 0.44, caught by `pnpm check`.
- **Fixed env import path** `../_core/env.js` → `../server/_core/env.js`
  (Phase A verification): crashed `pnpm dev`.
- **Idempotent migrations** (`IF NOT EXISTS`) after `ER_TABLE_EXISTS_ERROR`
  on re-run (Phase A verification).
- **`"jsx": "react-jsx"` in tsconfig** (Phase A verification): `pnpm check`
  failed on every TSX file without it.
- **Statement-breakpoint markers**: Phase C migration was missing them
  (caught in Phase D review); added trailing markers to 0001/0002 for
  journal consistency (Phase G).

## P2

- **Honesty matrices**: `LANGUAGE_SUPPORT.md` (verified/partial/
  experimental per language × capability) and `VOICE_SUPPORT.md`
  (browser × language) — never claim support from a few LLM sentences.
- **Demote guards**: no self-demote, no last-admin demote, with the
  self-message taking precedence; audit-logged.
- **Retry-After on contact 429** (Phase G): same header discipline as auth.
- **Stale landing copy** (Phase G): "under construction / coming soon"
  badges removed now the features exist; voice labeled experimental.
- **ARCHITECTURE.md REST drift fix** (Phase G): doc said `{ ok, data }`
  envelope; code returns flat shapes — doc corrected to reality.

## P3

- **`pnpm start` script** (Phase G): `node dist-server/server/_core/index.js`
  for production (with `NODE_ENV=production` in `.env`).
- **Docs set**: SECURITY.md audit, DEPLOYMENT.md, TROUBLESHOOTING.md
  (10 real issues), ARCHITECTURE_DECISIONS.md (7 ADRs), TESTING.md
  consolidated into one ordered script.
- **FEATURE_STATUS.md honesty pass** (Phase G): "Done" → "Implemented —
  PC verification pending" where no PC evidence exists.
