/**
 * Minimal security headers (no new dependencies — helmet not needed).
 *
 * - X-Content-Type-Options: nosniff — blocks MIME-sniffing of responses.
 * - X-Frame-Options: DENY — the app is never meant to be framed.
 * - Referrer-Policy: no-referrer — never leak the session-bearing origin.
 *
 * Applied to every response (API + client) in server/_core/index.ts.
 */
import type { NextFunction, Request, Response } from "express";

export function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
}
