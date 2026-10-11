/**
 * Public contact API (mounted at /api/v1/contact).
 *
 * POST / — no auth required. Validates name/email/message, then stores the
 * message for admin review. Rate-limited to 5 submissions per hour per IP
 * (in-memory, single-instance — see server/lib/rateLimit.ts). Returns
 * 201 { ok: true } on success; the stored message is never echoed back
 * beyond that confirmation.
 */
import { Router } from "express";
import { db } from "../../drizzle/db.js";
import { contactMessages } from "../../drizzle/schema.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { isRateLimited, recordHit, retryAfterSeconds } from "../lib/rateLimit.js";
import { normalizeEmail, validateContactInput } from "../lib/validation.js";

const router = Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const ip = req.ip ?? "unknown";
    if (isRateLimited(ip)) {
      res.set("Retry-After", String(retryAfterSeconds(ip)));
      res
        .status(429)
        .json({ error: "Too many messages. Please try again in a while." });
      return;
    }
    const validationError = validateContactInput(req.body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    const name = (req.body.name as string).trim();
    const email = normalizeEmail(req.body.email as string);
    const message = (req.body.message as string).trim();

    recordHit(ip);
    await db.insert(contactMessages).values({ name, email, message });
    res.status(201).json({ ok: true });
  })
);

export default router;
