/**
 * User settings API (mounted at /api/v1/settings, all endpoints require auth).
 *
 * - GET /languages  → my four language settings + the honest language catalog
 * - PUT /languages  → validate + upsert the four settings (partial updates
 *                     allowed: only provided fields are changed)
 *
 * The catalog ships support levels so the UI can label every language
 * honestly (verified / partial / experimental) instead of claiming
 * support we have not earned. See server/lib/languages.ts and
 * LANGUAGE_SUPPORT.md.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../drizzle/db.js";
import { userLanguageSettings } from "../../drizzle/schema.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  DEFAULT_LANGUAGE_SETTINGS,
  EVALUATION_LANGUAGE_CODES,
  FEEDBACK_LANGUAGE_CODES,
  INTERVIEW_LANGUAGE_CODES,
  isValidLanguageFor,
  LANGUAGE_SETTING_EXPLANATIONS,
  LANGUAGE_SETTING_KEYS,
  languageSettingError,
  RESPONSE_LANGUAGE_CODES,
  SUPPORTED_LANGUAGE_CODES,
  type LanguageSettingKey,
  type LanguageSettings,
} from "../lib/languages.js";

const router = Router();

function userIdOf(req: Request): number | null {
  return req.user?.id ?? null;
}

function toPublicSettings(row: typeof userLanguageSettings.$inferSelect): LanguageSettings {
  return {
    interviewLanguage: row.interviewLanguage,
    responseLanguage: row.responseLanguage,
    feedbackLanguage: row.feedbackLanguage,
    evaluationLanguage: row.evaluationLanguage,
  };
}

async function loadSettings(userId: number): Promise<LanguageSettings> {
  const rows = await db
    .select()
    .from(userLanguageSettings)
    .where(eq(userLanguageSettings.userId, userId))
    .limit(1);
  return rows[0] ? toPublicSettings(rows[0]) : { ...DEFAULT_LANGUAGE_SETTINGS };
}

// ---------------------------------------------------------------------------
// GET /languages — my settings + the honest catalog
// ---------------------------------------------------------------------------

router.get(
  "/languages",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    if (userId === null) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const settings = await loadSettings(userId);
    res.status(200).json({
      settings,
      catalog: SUPPORTED_LANGUAGE_CODES,
      explanations: LANGUAGE_SETTING_EXPLANATIONS,
      // Honest per-setting options: the UI offers exactly what exists.
      allowed: {
        interviewLanguage: [...INTERVIEW_LANGUAGE_CODES],
        responseLanguage: [...RESPONSE_LANGUAGE_CODES],
        feedbackLanguage: [...FEEDBACK_LANGUAGE_CODES],
        evaluationLanguage: [...EVALUATION_LANGUAGE_CODES],
      } satisfies Record<LanguageSettingKey, string[]>,
    });
  })
);

// ---------------------------------------------------------------------------
// PUT /languages — validate + upsert (partial updates allowed)
// ---------------------------------------------------------------------------

router.put(
  "/languages",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    if (userId === null) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (typeof req.body !== "object" || req.body === null) {
      res.status(400).json({ error: "Invalid request body." });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const updates: Partial<LanguageSettings> = {};
    for (const key of LANGUAGE_SETTING_KEYS) {
      const value = body[key];
      if (value === undefined || value === null) continue;
      if (!isValidLanguageFor(key, value)) {
        res.status(400).json({ error: languageSettingError(key as LanguageSettingKey) });
        return;
      }
      updates[key] = value as string;
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Provide at least one language setting to update." });
      return;
    }

    const existing = await db
      .select()
      .from(userLanguageSettings)
      .where(eq(userLanguageSettings.userId, userId))
      .limit(1);

    if (existing[0]) {
      await db
        .update(userLanguageSettings)
        .set(updates)
        .where(eq(userLanguageSettings.userId, userId));
    } else {
      await db.insert(userLanguageSettings).values({
        userId,
        ...DEFAULT_LANGUAGE_SETTINGS,
        ...updates,
      });
    }

    const settings = await loadSettings(userId);
    res.status(200).json({ settings });
  })
);

export default router;
