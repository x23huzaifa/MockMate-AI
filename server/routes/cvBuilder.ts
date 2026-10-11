/**
 * AI CV Builder API (mounted at /api/v1/cv-builder, all endpoints require auth).
 *
 * - GET    /              → list my documents (id, title, template, updatedAt)
 * - POST   /              → create a document { title?, template? }
 * - GET    /:id           → full document
 * - PUT    /:id           → update { title?, template?, content? }
 * - DELETE /:id           → delete document
 * - POST   /:id/duplicate → copy a document
 * - POST   /assist        → AI section assist { section, userBullets[], targetRole? }
 *                          Uses the active provider's buildCVSection; the template
 *                          provider throws AINotSupportedError → 503 (honest, never
 *                          faked). Rate-limited: 20/hr per user.
 *
 * Every :id endpoint returns 404 "CV document not found." for both missing
 * rows and other users' rows (no IDOR leak) via ownsDocument().
 *
 * HONESTY: the model must never invent degrees, employers, or skills — the
 * prompt is built only from the user's own bullets, and the UI keeps every
 * AI suggestion editable before saving.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../../drizzle/db.js";
import {
  cvDocuments,
  type CvBuilderContent,
  type CvDocument,
} from "../../drizzle/schema.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { aiAssistLimiter } from "../lib/rateLimit.js";
import { getQuestionProvider } from "../ai/index.js";
import {
  AIConfigError,
  AIError,
  AINotSupportedError,
  AIQuotaExceededError,
} from "../ai/errors.js";

const router = Router();

export const CV_DOC_TITLE_MAX_LENGTH = 200;
export const CV_ASSIST_BULLETS_MAX = 20;
export const CV_ASSIST_BULLET_MAX_LENGTH = 500;
export const CV_ASSIST_SECTIONS = [
  "summary",
  "experience",
  "projects",
  "skills",
] as const;

export type CvAssistSection = (typeof CV_ASSIST_SECTIONS)[number];

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// ---------------------------------------------------------------------------

function userIdOf(req: Request): number | null {
  return req.user?.id ?? null;
}

export function parseIdParam(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(s);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Ownership gate: missing row OR another user's row → not owned. */
export function ownsDocument(
  doc: CvDocument | null | undefined,
  userId: number
): doc is CvDocument {
  return !!doc && doc.userId === userId;
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

export function isValidTemplate(value: unknown): boolean {
  return (
    value === "modern" || value === "minimal" || value === "professional"
  );
}

export function validateCreateInput(
  body: unknown
): ValidationResult<{ title: string; template: string }> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid input." };
  }
  const b = body as { title?: unknown; template?: unknown };
  const title = b.title === undefined ? "Untitled CV" : b.title;
  if (typeof title !== "string" || title.trim().length === 0) {
    return { ok: false, error: "Title must be a non-empty string." };
  }
  if (title.trim().length > CV_DOC_TITLE_MAX_LENGTH) {
    return {
      ok: false,
      error: `Title must be at most ${CV_DOC_TITLE_MAX_LENGTH} characters.`,
    };
  }
  const template = b.template === undefined ? "modern" : b.template;
  if (!isValidTemplate(template)) {
    return {
      ok: false,
      error: "Template must be one of: modern, minimal, professional.",
    };
  }
  return { ok: true, value: { title: title.trim(), template: template as string } };
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((v) => typeof v === "string")
  );
}

/** Structural validation for the CV content JSON — shapes, not truth. */
export function validateContent(
  body: unknown
): ValidationResult<CvBuilderContent> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Content must be an object." };
  }
  const c = body as Record<string, unknown>;
  const str = (v: unknown) => (v === undefined ? "" : v);
  for (const key of [
    "fullName",
    "email",
    "phone",
    "headline",
    "summary",
    "targetRole",
  ]) {
    const v = str(c[key]);
    if (typeof v !== "string") {
      return { ok: false, error: `Content field "${key}" must be a string.` };
    }
    if (v.length > 5000) {
      return {
        ok: false,
        error: `Content field "${key}" is too long (max 5000 chars).`,
      };
    }
  }
  if (
    c.education !== undefined &&
    (!Array.isArray(c.education) ||
      !c.education.every(
        (e) =>
          typeof e === "object" &&
          e !== null &&
          typeof (e as { school?: unknown }).school === "string"
      ))
  ) {
    return { ok: false, error: "Education entries must have a school name." };
  }
  for (const key of ["skills", "certifications", "languages"]) {
    if (c[key] !== undefined && !isStringArray(c[key])) {
      return { ok: false, error: `Content field "${key}" must be string[].` };
    }
  }
  return { ok: true, value: c as unknown as CvBuilderContent };
}

export function validateAssistInput(
  body: unknown
): ValidationResult<{
  section: CvAssistSection;
  userBullets: string[];
  targetRole?: string;
}> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid input." };
  }
  const b = body as {
    section?: unknown;
    userBullets?: unknown;
    targetRole?: unknown;
  };
  if (
    typeof b.section !== "string" ||
    !(CV_ASSIST_SECTIONS as readonly string[]).includes(b.section)
  ) {
    return {
      ok: false,
      error: `Section must be one of: ${CV_ASSIST_SECTIONS.join(", ")}.`,
    };
  }
  if (!Array.isArray(b.userBullets) || b.userBullets.length === 0) {
    return { ok: false, error: "Provide at least one bullet of your own." };
  }
  if (b.userBullets.length > CV_ASSIST_BULLETS_MAX) {
    return {
      ok: false,
      error: `At most ${CV_ASSIST_BULLETS_MAX} bullets per request.`,
    };
  }
  for (const bullet of b.userBullets) {
    if (typeof bullet !== "string" || bullet.trim().length === 0) {
      return { ok: false, error: "Bullets must be non-empty strings." };
    }
    if (bullet.length > CV_ASSIST_BULLET_MAX_LENGTH) {
      return {
        ok: false,
        error: `Each bullet must be at most ${CV_ASSIST_BULLET_MAX_LENGTH} characters.`,
      };
    }
  }
  if (b.targetRole !== undefined && typeof b.targetRole !== "string") {
    return { ok: false, error: "Target role must be a string." };
  }
  return {
    ok: true,
    value: {
      section: b.section as CvAssistSection,
      userBullets: b.userBullets.map((x: string) => x.trim()),
      targetRole:
        typeof b.targetRole === "string" && b.targetRole.trim()
          ? b.targetRole.trim().slice(0, 200)
          : undefined,
    },
  };
}

export function toPublicDocument(row: CvDocument) {
  return {
    id: row.id,
    title: row.title,
    template: row.template,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toDocumentSummary(row: CvDocument) {
  return {
    id: row.id,
    title: row.title,
    template: row.template,
    updatedAt: row.updatedAt,
  };
}

/** 503 payload when the AI assist needs a real provider — honest, actionable. */
export function assistUnconfiguredBody(): { error: string; hint: string } {
  return {
    error: "AI writing assist requires a configured AI provider.",
    hint: "Set AI_PROVIDER=gemini and GEMINI_API_KEY in .env — see AI_SETUP.md. You can still write every section manually.",
  };
}

// ---------------------------------------------------------------------------
// Internal data access
// ---------------------------------------------------------------------------

async function loadOwnedDocument(
  req: Request,
  res: Response
): Promise<CvDocument | null> {
  const userId = userIdOf(req);
  if (userId === null) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const id = parseIdParam(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "CV document not found." });
    return null;
  }
  const rows = await db
    .select()
    .from(cvDocuments)
    .where(eq(cvDocuments.id, id))
    .limit(1);
  const doc = rows[0] ?? null;
  if (!ownsDocument(doc, userId)) {
    res.status(404).json({ error: "CV document not found." });
    return null;
  }
  return doc;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    if (userId === null) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const rows = await db
      .select()
      .from(cvDocuments)
      .where(eq(cvDocuments.userId, userId))
      .orderBy(desc(cvDocuments.updatedAt));
    res.json({ documents: rows.map(toDocumentSummary) });
  })
);

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    if (userId === null) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const checked = validateCreateInput(req.body);
    if (!checked.ok || !checked.value) {
      res.status(400).json({ error: checked.error ?? "Invalid input." });
      return;
    }
    await db.insert(cvDocuments).values({
      userId,
      title: checked.value.title,
      template: checked.value.template,
    });
    // Re-select the newest row for this user (established pattern — no
    // reliance on driver insertId).
    const rows = await db
      .select()
      .from(cvDocuments)
      .where(eq(cvDocuments.userId, userId))
      .orderBy(desc(cvDocuments.id))
      .limit(1);
    if (!rows[0]) {
      res.status(500).json({ error: "Internal server error." });
      return;
    }
    res.status(201).json({ document: toPublicDocument(rows[0]) });
  })
);

router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const doc = await loadOwnedDocument(req, res);
    if (!doc) return;
    res.json({ document: toPublicDocument(doc) });
  })
);

router.put(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const doc = await loadOwnedDocument(req, res);
    if (!doc) return;
    if (typeof req.body !== "object" || req.body === null) {
      res.status(400).json({ error: "Invalid input." });
      return;
    }
    const b = req.body as {
      title?: unknown;
      template?: unknown;
      content?: unknown;
    };
    const patch: Partial<{ title: string; template: string; content: CvBuilderContent }> = {};
    if (b.title !== undefined) {
      if (
        typeof b.title !== "string" ||
        b.title.trim().length === 0 ||
        b.title.trim().length > CV_DOC_TITLE_MAX_LENGTH
      ) {
        res.status(400).json({ error: "Title must be a non-empty string." });
        return;
      }
      patch.title = b.title.trim();
    }
    if (b.template !== undefined) {
      if (!isValidTemplate(b.template)) {
        res.status(400).json({
          error: "Template must be one of: modern, minimal, professional.",
        });
        return;
      }
      patch.template = b.template as string;
    }
    if (b.content !== undefined) {
      const checked = validateContent(b.content);
      if (!checked.ok || !checked.value) {
        res.status(400).json({ error: checked.error ?? "Invalid content." });
        return;
      }
      patch.content = checked.value;
    }
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "Nothing to update." });
      return;
    }
    await db
      .update(cvDocuments)
      .set(patch)
      .where(eq(cvDocuments.id, doc.id));
    const rows = await db
      .select()
      .from(cvDocuments)
      .where(eq(cvDocuments.id, doc.id))
      .limit(1);
    res.json({ document: toPublicDocument(rows[0]) });
  })
);

router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const doc = await loadOwnedDocument(req, res);
    if (!doc) return;
    await db.delete(cvDocuments).where(eq(cvDocuments.id, doc.id));
    res.json({ ok: true });
  })
);

router.post(
  "/:id/duplicate",
  requireAuth,
  asyncHandler(async (req, res) => {
    const doc = await loadOwnedDocument(req, res);
    if (!doc) return;
    await db.insert(cvDocuments).values({
      userId: doc.userId,
      title: `${doc.title} (copy)`.slice(0, CV_DOC_TITLE_MAX_LENGTH),
      template: doc.template,
      content: doc.content,
    });
    const rows = await db
      .select()
      .from(cvDocuments)
      .where(eq(cvDocuments.userId, doc.userId))
      .orderBy(desc(cvDocuments.id))
      .limit(1);
    if (!rows[0]) {
      res.status(500).json({ error: "Internal server error." });
      return;
    }
    res.status(201).json({ document: toPublicDocument(rows[0]) });
  })
);

// AI writing assist — one LLM call per request, rate-limited per user.
router.post(
  "/assist",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    if (userId === null) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const rateKey = `cv-assist:${userId}`;
    if (aiAssistLimiter.isLimited(rateKey)) {
      res.set(
        "Retry-After",
        String(aiAssistLimiter.retryAfterSeconds(rateKey))
      );
      res.status(429).json({
        error:
          "Too many AI assist requests. Please wait a while before trying again.",
      });
      return;
    }
    const checked = validateAssistInput(req.body);
    if (!checked.ok || !checked.value) {
      res.status(400).json({ error: checked.error ?? "Invalid input." });
      return;
    }

    const provider = getQuestionProvider();
    if (typeof provider.buildCVSection !== "function") {
      res.status(503).json(assistUnconfiguredBody());
      return;
    }
    aiAssistLimiter.record(rateKey);
    try {
      const result = await provider.buildCVSection({
        section: checked.value.section,
        userBullets: checked.value.userBullets,
        targetRole: checked.value.targetRole,
      });
      res.json({ suggestion: result });
    } catch (err) {
      if (err instanceof AINotSupportedError || err instanceof AIConfigError) {
        res.status(503).json(assistUnconfiguredBody());
        return;
      }
      if (err instanceof AIQuotaExceededError) {
        res.status(429).json({
          error: "AI is busy right now. Try again in a moment.",
        });
        return;
      }
      if (err instanceof AIError) {
        res.status(502).json({
          error: "The AI provider returned an unusable response. Try again.",
        });
        return;
      }
      throw err;
    }
  })
);

export default router;
