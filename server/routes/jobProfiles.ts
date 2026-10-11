/**
 * Job-profile API — POST / | GET / | GET /:id | PATCH /:id | DELETE /:id
 * (mounted at /api/v1/job-profiles, all endpoints require authentication).
 *
 * A job profile describes the role a user is practicing for (title,
 * company, description, required skills). Interviews optionally reference
 * one; deleting a profile sets interview_sessions.jobProfileId to NULL.
 *
 * Response shapes follow the project convention: success → { jobProfile } /
 * { jobProfiles } / { ok: true }; errors → { error: "<message>" }.
 * Per-profile endpoints return 404 "Job profile not found." for both
 * missing rows and other users' rows (no IDOR leak).
 */
import { Router } from "express";
import type { Request } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../../drizzle/db.js";
import { jobProfiles } from "../../drizzle/schema.js";
import type { JobProfile } from "../../drizzle/schema.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { ownsJobProfile } from "../lib/interviewGuards.js";
import { validateJobProfileInput } from "../lib/interviewValidation.js";

const router = Router();

function userIdOf(req: Request): number | null {
  return req.user?.id ?? null;
}

function parseIdParam(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(s);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function toPublicJobProfile(row: JobProfile) {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    description: row.description,
    requiredSkills: row.requiredSkills ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function findJobProfile(id: number): Promise<JobProfile | null> {
  const rows = await db
    .select()
    .from(jobProfiles)
    .where(eq(jobProfiles.id, id))
    .limit(1);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// POST / — create a job profile
// ---------------------------------------------------------------------------

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    if (userId === null) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const checked = validateJobProfileInput(req.body);
    if (!checked.ok || !checked.value) {
      res.status(400).json({ error: checked.error ?? "Invalid input." });
      return;
    }
    const v = checked.value;
    await db.insert(jobProfiles).values({
      userId,
      title: v.title,
      company: v.company,
      description: v.description,
      requiredSkills: v.requiredSkills,
    });
    // Re-select by user + title + createdAt window would be racy; instead
    // fetch the newest row for this user+title (titles are not unique, but
    // this is the row we just inserted — ordered by id desc, limit 1).
    const created = (
      await db
        .select()
        .from(jobProfiles)
        .where(eq(jobProfiles.userId, userId))
        .orderBy(desc(jobProfiles.id))
        .limit(1)
    )[0];
    if (!created) {
      res.status(500).json({ error: "Internal server error." });
      return;
    }
    res.status(201).json({ jobProfile: toPublicJobProfile(created) });
  })
);

// ---------------------------------------------------------------------------
// GET / — list my job profiles (newest first)
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
      .from(jobProfiles)
      .where(eq(jobProfiles.userId, userId))
      .orderBy(desc(jobProfiles.createdAt));
    res.status(200).json({ jobProfiles: rows.map(toPublicJobProfile) });
  })
);

// ---------------------------------------------------------------------------
// GET /:id — one of my job profiles (404 for missing OR others')
// ---------------------------------------------------------------------------

router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    const id = parseIdParam(req.params.id);
    if (userId === null || id === null) {
      res.status(userId === null ? 401 : 404).json({
        error: userId === null ? "Unauthorized" : "Job profile not found.",
      });
      return;
    }
    const row = await findJobProfile(id);
    if (!ownsJobProfile(row, userId)) {
      res.status(404).json({ error: "Job profile not found." });
      return;
    }
    res.status(200).json({ jobProfile: toPublicJobProfile(row) });
  })
);

// ---------------------------------------------------------------------------
// PATCH /:id — update my job profile (validated)
// ---------------------------------------------------------------------------

router.patch(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    const id = parseIdParam(req.params.id);
    if (userId === null || id === null) {
      res.status(userId === null ? 401 : 404).json({
        error: userId === null ? "Unauthorized" : "Job profile not found.",
      });
      return;
    }
    const row = await findJobProfile(id);
    if (!ownsJobProfile(row, userId)) {
      res.status(404).json({ error: "Job profile not found." });
      return;
    }
    const checked = validateJobProfileInput(req.body);
    if (!checked.ok || !checked.value) {
      res.status(400).json({ error: checked.error ?? "Invalid input." });
      return;
    }
    const v = checked.value;
    await db
      .update(jobProfiles)
      .set({
        title: v.title,
        company: v.company,
        description: v.description,
        requiredSkills: v.requiredSkills,
      })
      .where(eq(jobProfiles.id, id));
    const updated = await findJobProfile(id);
    if (!updated) {
      res.status(404).json({ error: "Job profile not found." });
      return;
    }
    res.status(200).json({ jobProfile: toPublicJobProfile(updated) });
  })
);

// ---------------------------------------------------------------------------
// DELETE /:id — delete my job profile (sessions keep going, FK → NULL)
// ---------------------------------------------------------------------------

router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    const id = parseIdParam(req.params.id);
    if (userId === null || id === null) {
      res.status(userId === null ? 401 : 404).json({
        error: userId === null ? "Unauthorized" : "Job profile not found.",
      });
      return;
    }
    const row = await findJobProfile(id);
    if (!ownsJobProfile(row, userId)) {
      res.status(404).json({ error: "Job profile not found." });
      return;
    }
    await db.delete(jobProfiles).where(eq(jobProfiles.id, id));
    res.status(200).json({ ok: true });
  })
);

export default router;
