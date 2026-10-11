/**
 * Auth API — POST /api/v1/auth/register | /login | /logout, GET /me.
 *
 * Response shapes: success → { user } (201 on register, 200 otherwise) or
 * { ok: true }; errors → { error: "<message>" } with the correct status.
 * Login failures always return the generic "Invalid email or password."
 * so responses never reveal whether an email is registered (no enumeration).
 */
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../drizzle/db.js";
import { users } from "../../drizzle/schema.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
} from "../lib/auth.js";
import {
  normalizeEmail,
  validateLoginInput,
  validateRegisterInput,
} from "../lib/validation.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { authLimiter } from "../lib/rateLimit.js";
import { ENV } from "../_core/env.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

type PublicUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

function toPublicUser(row: typeof users.$inferSelect): PublicUser {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

function isDuplicateEntryError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ER_DUP_ENTRY"
  );
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    // Brute-force guard: 10 attempts / 15 min / IP (in-memory, single-instance).
    const ip = req.ip ?? "unknown";
    if (authLimiter.isLimited(ip)) {
      res.set(
        "Retry-After",
        String(authLimiter.retryAfterSeconds(ip))
      );
      res
        .status(429)
        .json({ error: "Too many attempts. Please try again later." });
      return;
    }
    authLimiter.record(ip);
    const validationError = validateRegisterInput(req.body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    const name = (req.body.name as string).trim();
    const email = normalizeEmail(req.body.email as string);
    const password = req.body.password as string;

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Email already registered." });
      return;
    }

    const passwordHash = await hashPassword(password);

    // Admin bootstrap: the email in ADMIN_EMAIL (when set) registers as the
    // first admin. The assignment is written to audit_logs for the record.
    // Comparison is case-insensitive (both sides normalized to lowercase).
    const isAdminBootstrap =
      ENV.ADMIN_EMAIL !== null && email === ENV.ADMIN_EMAIL;
    const role = isAdminBootstrap ? "admin" : "user";

    try {
      await db.insert(users).values({ name, email, passwordHash, role });
    } catch (err) {
      // Race-safe backstop: the UNIQUE constraint is the source of truth.
      if (isDuplicateEntryError(err)) {
        res.status(409).json({ error: "Email already registered." });
        return;
      }
      throw err;
    }

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    const created = rows[0];
    if (!created) {
      res.status(500).json({ error: "Internal server error." });
      return;
    }

    if (isAdminBootstrap) {
      await logAudit(
        created.id,
        "auth.user.registered_as_admin",
        "user",
        created.id,
        { email: created.email }
      );
    }

    const token = await signSession({
      userId: created.id,
      role: created.role,
    });
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    res.status(201).json({ user: toPublicUser(created) });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    // Same brute-force guard as /register (shared IP quota).
    const ip = req.ip ?? "unknown";
    if (authLimiter.isLimited(ip)) {
      res.set(
        "Retry-After",
        String(authLimiter.retryAfterSeconds(ip))
      );
      res
        .status(429)
        .json({ error: "Too many attempts. Please try again later." });
      return;
    }
    authLimiter.record(ip);
    const validationError = validateLoginInput(req.body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    const email = normalizeEmail(req.body.email as string);
    const password = req.body.password as string;

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    const user = rows[0] ?? null;
    const passwordOk = user
      ? await verifyPassword(password, user.passwordHash)
      : false;
    if (!user || !passwordOk) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const token = await signSession({ userId: user.id, role: user.role });
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    res.status(200).json({ user: toPublicUser(user) });
  })
);

router.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.status(200).json({ ok: true });
});

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);
    const user = rows[0] ?? null;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.status(200).json({ user: toPublicUser(user) });
  })
);

export default router;
