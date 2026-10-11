# DEPLOYMENT.md — InterviewSaathi AI

Honest production notes. This app has been **built but never deployed** —
treat everything below as the documented path, not a verified runbook.
Verify each step on the target machine before calling it production-ready.

## What production looks like

- **Single process, single port.** Express serves the API and the static
  client — no reverse proxy required for v1, no CORS.
- **Build:** `pnpm build` → client bundle in `dist/`, compiled server in
  `dist-server/` (`tsconfig.server.json`: `rootDir "."`, `outDir "dist-server"`).
- **Run:** set `NODE_ENV=production` in `.env`, then `pnpm start`
  (`node dist-server/server/_core/index.js`). With `NODE_ENV=production`,
  Express serves `dist/` statically + SPA fallback instead of Vite
  middleware. `secure` cookies turn on automatically (requires HTTPS).
- **Database:** a real MySQL 8 / MariaDB 10.4+ with the `interview_saathi`
  database migrated (`pnpm db:migrate` runs against `DATABASE_URL`).

## Environment variables (production)

| Var | Required | Notes |
| --- | -------- | ----- |
| `DATABASE_URL` | yes | `mysql://user:pass@host:3306/interview_saathi` — never commit |
| `JWT_SECRET` | yes | ≥ 32 chars, random per environment |
| `NODE_ENV` | yes (set `production`) | switches client serving + `secure` cookies |
| `PORT` | no | default 3100 |
| `ADMIN_EMAIL` | no | bootstrap admin; set before first registration |

## Checklist before going live

1. `pnpm build` completes with zero errors (never executed by the author — run it).
2. `pnpm db:migrate` applied against the production database.
3. `NODE_ENV=production` in `.env`; HTTPS in front (self-signed is not enough for `secure` cookies to work in real browsers — use a proper cert).
4. `server/uploads/` exists and is writable, and is **not** web-accessible except through the app (the code never serves it statically — keep it that way).
5. **Rate limits are single-instance** (`server/lib/rateLimit.ts`). One process = fine. Behind multiple processes / a load balancer, move to a shared store (Redis) — currently a documented P2.
6. Back up the database regularly (`mysqldump`); test restores.
7. Add a strict Content-Security-Policy header before public launch (currently P3 in SECURITY.md).

## Known gaps (not silent)

- The production path (`pnpm build` → `pnpm start` with `NODE_ENV=production`)
  has never been executed end-to-end, even by the author. The pieces are
  coherent on paper (outDirs, static serving, cwd-relative paths) — verify
  before relying on it.
- No process manager, no log rotation, no health-check endpoint beyond
  `/api/v1/health` (which is unauthenticated by design — fine for a
  load-balancer probe, but don't expose admin routes publicly).
- `pnpm start` assumes you run it from the project root (`process.cwd()` is
  used for `dist/` and `server/uploads/` resolution).
