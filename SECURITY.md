# SECURITY.md — MockMate AI

Security audit of every route, written 2026-10-11 (Phase G). Findings marked
**[FIXED]** were changed in code during this phase; **[OK]** passed audit;
**[P2]/[P3]** are documented follow-ups, not silent gaps.

## 1. Authorization — route-by-route

Public by design (no session needed): `GET /api/v1/health`,
`POST /api/v1/auth/register`, `POST /api/v1/auth/login`,
`POST /api/v1/auth/logout`, `POST /api/v1/contact`.

| Route | Guard | Verdict |
| ----- | ----- | ------- |
| `GET /api/v1/health` | none (public) | **[OK]** — returns only `{ ok, service }` |
| `POST /api/v1/auth/register` | public + rate limit **[FIXED]** | **[OK]** — validated input, 409 on duplicate, no enumeration |
| `POST /api/v1/auth/login` | public + rate limit **[FIXED]** | **[OK]** — generic 401, no enumeration |
| `POST /api/v1/auth/logout` | none (clears cookie) | **[OK]** — stateless; clearing the cookie ends the browser session |
| `GET /api/v1/auth/me` | `requireAuth` | **[OK]** |
| `POST /api/v1/cvs` | `requireAuth` | **[OK]** |
| `GET /api/v1/cvs` | `requireAuth` | **[OK]** — scoped to `req.user.id` |
| `GET /api/v1/cvs/:id` | `requireAuth` + `ownsCv` | **[OK]** — 404 identical for missing/other's (no IDOR) |
| `PATCH /api/v1/cvs/:id` | `requireAuth` + `ownsCv` + `validateCorrections` | **[OK]** |
| `DELETE /api/v1/cvs/:id` | `requireAuth` + `ownsCv` | **[OK]** — deletes file + row |
| `POST /api/v1/job-profiles` | `requireAuth` | **[OK]** |
| `GET /api/v1/job-profiles` | `requireAuth` | **[OK]** — scoped to user |
| `GET /api/v1/job-profiles/:id` | `requireAuth` + `ownsJobProfile` | **[OK]** — 404 identical (no IDOR) |
| `PATCH /api/v1/job-profiles/:id` | `requireAuth` + `ownsJobProfile` | **[OK]** |
| `DELETE /api/v1/job-profiles/:id` | `requireAuth` + `ownsJobProfile` | **[OK]** |
| `POST /api/v1/interviews` | `requireAuth` | **[OK]** — referenced jobProfile/cv re-checked for ownership |
| `GET /api/v1/interviews` | `requireAuth` | **[OK]** — scoped to user |
| `GET /api/v1/interviews/:id` (+`/report`) | `requireAuth` + `ownsSession` | **[OK]** — 404 identical (no IDOR) |
| `POST /api/v1/interviews/:id/{start,answer,pause,resume,interrupt}` | `requireAuth` + `ownsSession` + state machine | **[OK]** |
| `GET /api/v1/settings/languages` | `requireAuth` | **[OK]** |
| `PUT /api/v1/settings/languages` | `requireAuth` + per-setting allowlist | **[OK]** |
| `GET /api/v1/progress/overview` | `requireAuth` | **[OK]** — aggregates caller's rows only |
| `POST /api/v1/contact` | public + rate limit (5/hour/IP) | **[OK]** — validated, never echoes input |
| `GET /api/v1/admin/*` | `requireAdmin` (401 → 403) | **[OK]** — every route under `router.use(requireAdmin)` |
| `PATCH /api/v1/admin/users/:id/role` | `requireAdmin` + self-demote/last-admin guards | **[OK]** |

**[FIXED] P1 — auth brute force:** login/register had no rate limiting.
Added `authLimiter` (10 attempts / 15 min / IP, in-memory, `429` +
`Retry-After`) to both endpoints in `server/routes/auth.ts`.

**[P2]** No account lockout or CAPTCHA — the rate limiter is the only
brute-force control. Acceptable for v1 scale; revisit if abuse is observed.

**[P3]** JWT role is baked into the token: a role change takes effect on the
user's next login. Documented tradeoff of stateless sessions (see
ARCHITECTURE.md), not a vulnerability.

## 2. Upload hardening

- **Type check:** magic bytes (`%PDF` / `PK\x03\x04`), never extension or
  client MIME — `server/lib/cvFiles.ts:detectCvType`. A renamed `.exe` is
  rejected with 400. **[OK]**
- **Size:** 5 MB enforced by multer (`LIMIT_FILE_SIZE` → 413 JSON) and the
  route re-checks `file.size === 0`. **[OK]**
- **Storage:** `server/uploads/cvs/<userId>/<random-uuid>.<ext>` — the
  original filename never touches disk (no path traversal), the directory
  is git-ignored and never served by `express.static`. **[OK]**
- **Exposure:** `storedPath` is stripped from every API response
  (`toPublicCv`); files are reachable only through ownership-checked
  endpoints. **[OK]**
- **[P3]** Uploaded files are not virus-scanned. Out of scope for v1
  (single-user dev scale); note before any shared hosting.

## 3. Secret hygiene

- Grep for hardcoded secrets/tokens/keys across `*.ts`, `*.tsx`, `*.json`,
  `*.example`, `*.md`: **none found** (2026-10-11). **[OK]**
- `.env` is git-ignored; `.env.example` contains placeholders only.
  **[OK]**
- `JWT_SECRET` must be ≥ 32 chars — enforced fail-fast in
  `server/_core/env.ts`; the server refuses to boot without it. **[OK]**
- Cookie flags: `httpOnly`, `sameSite: "lax"`, `secure` in production,
  `path: "/"`, 7-day `maxAge` — `server/lib/auth.ts:sessionCookieOptions`.
  **[OK]**
- Passwords: bcryptjs (12 rounds); plaintext never logged/stored/returned.
  **[OK]**

## 4. Input validation

- Every POST/PATCH body is validated (`server/lib/validation.ts`,
  `cvValidation.ts`, `interviewValidation.ts`, per-setting allowlists in
  `languages.ts`): length caps on all strings (name ≤ 80, title ≤ 120,
  message ≤ 2000, answer 1–5000, skills ≤ 30 × 50 chars), enums allowlisted.
  **[OK]**
- Every `:id` param parsed via `parseIdParam` (positive integer) → 404/400
  on garbage; no raw param reaches SQL (Drizzle parameterizes everything).
  **[OK]**
- `express.json({ limit: "1mb" })` caps JSON bodies. **[OK]**
- **[P2]** No WAF / schema-level request validation library — hand-written
  validators cover all current routes; re-audit when routes are added.

## 5. Error safety

- `asyncHandler` catches every async throw → logs server-side → generic
  `500 { error: "Internal server error." }`. No stack traces, SQL, or paths
  leak. Verified by reading every route: all async handlers are wrapped.
  **[OK]**
- 404s are identical for "missing" vs "someone else's" on all per-row
  endpoints (cvs, job-profiles, interviews) — no IDOR oracle. **[OK]**
- CV parse failures store a sanitized ≤ 200-char `errorMessage`. **[OK]**

## 6. Rate limiting

| Endpoint | Limit | Store |
| -------- | ----- | ----- |
| `POST /api/v1/contact` | 5 / hour / IP | in-memory Map |
| `POST /api/v1/auth/login`, `/register` | 10 / 15 min / IP **[FIXED]** | in-memory Map |

Both return `429` with a `Retry-After` (seconds) header.
**Single-instance only** — documented in README; a multi-instance deploy
needs a shared store (Redis). **[P2]** for production hardening.

## 7. Headers

`server/middleware/securityHeaders.ts` (added Phase G, wired in
`server/_core/index.ts` before all routes):
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: no-referrer`. No `helmet` dependency — zero new deps
was a standing rule. **[OK]**

**[P3]** No CSP header yet — the client is same-origin with no inline
third-party resources; add a strict CSP before any production launch.

## 8. Privacy rules (enforced in code)

- Admin session endpoints return **metadata only** — never answer
  transcripts, question text, or CV contents (`server/routes/admin.ts`).
- `passwordHash` is never selected into admin user-list rows (explicit
  column lists).
- Interview answers stored verbatim; transcripts never leave the API
  except to their owner.

## Summary

All P0/P1 findings fixed in code during Phase G. Remaining items are P2/P3
follow-ups listed above — documented here rather than silently deferred.
Re-run this audit whenever a route is added or changed.
