/**
 * Authentication guard for protected routes.
 *
 * Reads the `mockmate_session` httpOnly cookie, verifies the JWT, and attaches
 * `req.user = { id, role }`. Responds 401 JSON on missing/invalid/expired
 * sessions. Authorization (ownership, roles) is enforced per-route on top.
 */
import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE, verifySession } from "../lib/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; role: string };
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string" || token.length === 0) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const session = await verifySession(token);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.user = { id: session.userId, role: session.role };
  next();
}
