/**
 * CV API — POST / | GET / | GET /:id | PATCH /:id | DELETE /:id
 * (mounted at /api/v1/cvs, all endpoints require authentication).
 *
 * Upload flow: multipart "cv" field → multer (memory, 5 MB cap) → magic-byte
 * type detection (never extension/MIME) → private on-disk storage →
 * text extraction + rules-based parsing. The row moves
 * uploaded → processing → ready, or → failed with a sanitized errorMessage.
 *
 * Response shapes follow the project convention: success → { cv } / { cvs }
 * / { ok: true }; errors → { error: "<message>" }. Per-CV endpoints return
 * 404 "CV not found." for both missing rows and other users' rows (no IDOR
 * leak). `storedPath` is never exposed.
 */
import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { desc, eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { db } from "../../drizzle/db.js";
import { cvs } from "../../drizzle/schema.js";
import type { Cv, CvFields } from "../../drizzle/schema.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { extractCvText, parseCvText } from "../lib/cvParser.js";
import {
  CV_MAX_BYTES,
  CV_MIME_TYPES,
  buildStoredPath,
  detectCvType,
  ownsCv,
} from "../lib/cvFiles.js";
import { validateCorrections } from "../lib/cvValidation.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CV_MAX_BYTES },
});

/** multer wrapper: oversized files → 413 JSON instead of a 500. */
function singleCvUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single("cv")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res
          .status(413)
          .json({ error: "File too large. Maximum size is 5 MB." });
        return;
      }
      res.status(400).json({ error: "File upload failed." });
      return;
    }
    if (err) {
      next(err as Error);
      return;
    }
    next();
  });
}

function userIdOf(req: Request): number | null {
  return req.user?.id ?? null;
}

function parseIdParam(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(s);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Public CV shape — storedPath is deliberately omitted. */
function toPublicCv(row: Cv) {
  return {
    id: row.id,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    status: row.status,
    parsedJson: row.parsedJson,
    userCorrectedJson: row.userCorrectedJson,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function findCv(id: number): Promise<Cv | null> {
  const rows = await db.select().from(cvs).where(eq(cvs.id, id)).limit(1);
  return rows[0] ?? null;
}

function absoluteStoredPath(storedPath: string): string {
  return path.resolve(process.cwd(), storedPath);
}

// ---------------------------------------------------------------------------
// POST / — upload a CV (PDF/DOCX, magic-byte validated, ≤ 5 MB)
// ---------------------------------------------------------------------------

router.post(
  "/",
  requireAuth,
  singleCvUpload,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    if (userId === null) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const file = req.file;
    if (!file || file.size === 0) {
      res
        .status(400)
        .json({ error: "No file uploaded. Attach a PDF or DOCX CV." });
      return;
    }

    const detected = detectCvType(file.buffer);
    if (!detected) {
      res.status(400).json({
        error: "Unsupported file type. Only PDF and DOCX files are accepted.",
      });
      return;
    }

    const originalFilename = (file.originalname || "upload").slice(0, 255);
    const storedPath = buildStoredPath(userId, detected);
    const absolutePath = absoluteStoredPath(storedPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, file.buffer);

    await db.insert(cvs).values({
      userId,
      originalFilename,
      storedPath,
      mimeType: CV_MIME_TYPES[detected],
      fileSize: file.size,
      status: "uploaded",
    });
    // Re-select by the unique stored path (same version-proof pattern as
    // auth.ts — no reliance on driver insertId).
    const created = (
      await db.select().from(cvs).where(eq(cvs.storedPath, storedPath)).limit(1)
    )[0];
    if (!created) {
      res.status(500).json({ error: "Internal server error." });
      return;
    }

    await db
      .update(cvs)
      .set({ status: "processing" })
      .where(eq(cvs.id, created.id));

    try {
      const rawText = await extractCvText(file.buffer, detected);
      const parsed = parseCvText(rawText);
      await db
        .update(cvs)
        .set({
          status: "ready",
          parsedJson: { ...parsed.fields, confidence: parsed.confidence },
          errorMessage: null,
        })
        .where(eq(cvs.id, created.id));
    } catch (err) {
      // Sanitized message only — no stack traces or file paths leak out.
      const message =
        err instanceof Error && err.message
          ? err.message.slice(0, 200)
          : "Could not parse this file.";
      await db
        .update(cvs)
        .set({ status: "failed", errorMessage: message })
        .where(eq(cvs.id, created.id));
    }

    const final = await findCv(created.id);
    if (!final) {
      res.status(500).json({ error: "Internal server error." });
      return;
    }
    res.status(201).json({ cv: toPublicCv(final) });
  })
);

// ---------------------------------------------------------------------------
// GET / — list my CVs (newest first)
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
      .from(cvs)
      .where(eq(cvs.userId, userId))
      .orderBy(desc(cvs.createdAt));
    res.status(200).json({ cvs: rows.map(toPublicCv) });
  })
);

// ---------------------------------------------------------------------------
// GET /:id — one of my CVs (404 for missing OR other users' — no IDOR)
// ---------------------------------------------------------------------------

router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    const id = parseIdParam(req.params.id);
    if (userId === null || id === null) {
      res.status(userId === null ? 401 : 404).json({
        error: userId === null ? "Unauthorized" : "CV not found.",
      });
      return;
    }
    const row = await findCv(id);
    if (!ownsCv(row, userId)) {
      res.status(404).json({ error: "CV not found." });
      return;
    }
    res.status(200).json({ cv: toPublicCv(row) });
  })
);

// ---------------------------------------------------------------------------
// PATCH /:id — save corrected fields (validated, merged over previous)
// ---------------------------------------------------------------------------

router.patch(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    const id = parseIdParam(req.params.id);
    if (userId === null || id === null) {
      res.status(userId === null ? 401 : 404).json({
        error: userId === null ? "Unauthorized" : "CV not found.",
      });
      return;
    }
    const row = await findCv(id);
    if (!ownsCv(row, userId)) {
      res.status(404).json({ error: "CV not found." });
      return;
    }

    const checked = validateCorrections(req.body);
    if (!checked.ok) {
      res.status(400).json({ error: checked.error });
      return;
    }

    const cv = row;
    const base: CvFields = {
      name: null,
      email: null,
      phone: null,
      skills: [],
      education: [],
      experienceYears: null,
      ...(cv.userCorrectedJson ?? {}),
    };
    if (!cv.userCorrectedJson && cv.parsedJson) {
      // Seed the correction form with the parser output (minus confidence).
      const p = cv.parsedJson;
      base.name = p.name;
      base.email = p.email;
      base.phone = p.phone;
      base.skills = p.skills;
      base.education = p.education;
      base.experienceYears = p.experienceYears;
    }
    const merged: CvFields = { ...base, ...checked.value };

    await db
      .update(cvs)
      .set({ userCorrectedJson: merged })
      .where(eq(cvs.id, id));

    const updated = await findCv(id);
    if (!updated) {
      res.status(404).json({ error: "CV not found." });
      return;
    }
    res.status(200).json({ cv: toPublicCv(updated) });
  })
);

// ---------------------------------------------------------------------------
// DELETE /:id — delete the stored file and the row
// ---------------------------------------------------------------------------

router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    const id = parseIdParam(req.params.id);
    if (userId === null || id === null) {
      res.status(userId === null ? 401 : 404).json({
        error: userId === null ? "Unauthorized" : "CV not found.",
      });
      return;
    }
    const row = await findCv(id);
    if (!ownsCv(row, userId)) {
      res.status(404).json({ error: "CV not found." });
      return;
    }

    // Best-effort file removal; the DB row is the source of truth.
    try {
      fs.rmSync(absoluteStoredPath(row.storedPath), { force: true });
    } catch {
      // fall through — still delete the row
    }
    await db.delete(cvs).where(eq(cvs.id, id));
    res.status(200).json({ ok: true });
  })
);

export default router;
