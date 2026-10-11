/**
 * Admin guard for /api/v1/admin routes.
 *
 * Runs requireAuth first (401 on missing/invalid session), then requires
 * `req.user.role === "admin"` — anything else gets 403 { error: "Forbidden" }.
 *
 * NOTE on role freshness: the role comes from the signed JWT, so a role
 * change takes effect on the target user's NEXT login (their current token
 * still carries the old role). Documented in ARCHITECTURE.md — a deliberate
 * tradeoff of stateless sessions, not a bug.
 */
import type { NextFunction, Request, Response } from "express";
import { requireAuth } from "./requireAuth.js";

/** Pure role check — unit-testable without HTTP mocks. */
export function isAdminRole(role: unknown): boolean {
  return role === "admin";
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  await requireAuth(req, res, () => {
    if (!req.user || !isAdminRole(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  });
}
