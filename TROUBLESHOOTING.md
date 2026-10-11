# TROUBLESHOOTING.md — InterviewSaathi AI

Real issues hit while building this project, each with symptom → cause →
fix. If you hit something new, add it here in the same format.

## 1. `pnpm install` ends with `ERR_PNPM_IGNORED_BUILDS`

**Symptom:** install "fails" listing ignored build scripts (`esbuild@...`).
**Cause:** pnpm's default policy skips postinstall scripts; the notice is
informational — packages still install.
**Fix:** none needed for this project (all deps are pure-JS). If a future
dependency genuinely needs its build script, run `pnpm approve-builds` and
approve that package only.

## 2. `bcrypt` native binding missing (`bcrypt_lib.node`)

**Symptom:** `pnpm test` crashes in `password.test.ts`:
`Cannot find module '.../bcrypt/lib/binding/napi-v3/bcrypt_lib.node'`.
**Cause:** `bcrypt` needs a node-gyp native build; its postinstall was
blocked by the ignored-builds policy (issue 1), so the binding was never
compiled.
**Fix:** replaced `bcrypt` with **`bcryptjs`** (pure JS, identical
hash/compare API, 12 rounds). No native build, no platform issues.
Lesson: prefer pure-JS dependencies on Windows.

## 3. `tsc` fails: "Cannot use JSX unless the '--jsx' flag is provided"

**Symptom:** `pnpm check` reports TS17004 on every `.tsx` file.
**Cause:** `tsconfig.json` was missing the `jsx` option (Vite handles JSX
at dev/build time, but `tsc --noEmit` needs the flag declared).
**Fix:** added `"jsx": "react-jsx"` to `tsconfig.json`.

## 4. `drizzle()` type error: `Property 'mode' is missing`

**Symptom:** `pnpm check` fails in `drizzle/db.ts` — `mode` is required.
**Cause:** drizzle-orm 0.44's mysql2 driver requires an explicit `mode`
(`"default"` | `"planetscale"`) in the config object.
**Fix:** `drizzle(pool, { schema, mode: "default" })`.

## 5. Wrong env import path breaks `pnpm dev`

**Symptom:** `pnpm dev` crashes: `ERR_MODULE_NOT_FOUND .../_core/env.js`
imported from `drizzle/db.ts`.
**Cause:** `drizzle/db.ts` imported `"../_core/env.js"`; the file actually
lives at `server/_core/env.ts`, so from `drizzle/` the correct relative
path is `"../server/_core/env.js"`.
**Fix:** corrected the import. (`pnpm check` catches this class of bug —
run it.)

## 6. `pnpm db:migrate`: `Table 'users' already exists` (ER_TABLE_EXISTS_ERROR)

**Symptom:** migration fails with errno 1050 on a database where the table
was already created (e.g. by an earlier partial run).
**Cause:** `CREATE TABLE` without `IF NOT EXISTS`; a previous run created
the table but didn't record the migration.
**Fix:** all hand-written migrations use `CREATE TABLE IF NOT EXISTS`
(idempotent — safe to re-run). Verify shape with `DESCRIBE` if unsure the
existing table matches.

## 7. `pnpm db:migrate`: `Can't find meta/_journal.json`

**Symptom:** drizzle-kit errors before applying anything.
**Cause:** the migrations folder was missing (e.g. files not extracted /
not pulled) — drizzle-kit needs `drizzle/migrations/meta/_journal.json`.
**Fix:** make sure the full project (including `drizzle/migrations/`) is
present, then re-run.

## 8. Migration runs but statements aren't split

**Symptom:** multi-statement migration behaves as one statement.
**Cause:** the journal declares `"breakpoints": true`, so drizzle-kit splits
on `--> statement-breakpoint` markers; a hand-written file without markers
is treated as a single statement.
**Fix:** end every migration file with `--> statement-breakpoint`
(single-statement files work either way, but the marker keeps the journal
honest).

## 9. Register/login fail after changing `JWT_SECRET`

**Symptom:** `401 Unauthorized` on every request right after rotating the secret.
**Cause:** sessions are stateless JWTs — old cookies were signed with the
old secret and no longer verify.
**Fix:** expected behavior, not a bug. Users sign in again; no server-side
session store to clear. (Same class of issue as the sibling project's
"Zero-length key is not supported" — here it fails loudly at startup
instead, via `env.ts`.)

## 10. `secure` cookies don't stick on local HTTP

**Symptom:** login works but the session is lost on refresh in production mode.
**Cause:** `secure: true` cookies are only sent over HTTPS; plain-HTTP local
testing drops them.
**Fix:** `secure` is on only when `NODE_ENV=production` — keep local dev on
the default (`development`). For prod, terminate HTTPS properly.
