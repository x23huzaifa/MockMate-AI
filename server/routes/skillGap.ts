/**
 * Skill gap analysis API (mounted at /api/v1/skill-gap, all endpoints require auth).
 *
 * No new tables — reads the user's confirmed CV skills, completed-interview
 * job profiles ("practiced" skills), and compares them against a target role's
 * required skills.
 *
 * - GET  /inputs   → { cvSkills, practicedSkills, jobProfiles }
 * - POST /analyze  → { targetRole, requiredSkills[] } (or { jobProfileId })
 *                    → { demonstrated[], needsEvidence[], missing[],
 *                        practiceQuestions, weeklyPlan, planProvider,
 *                        disclaimer }
 *
 * HONESTY:
 * - "demonstrated" = the skill is on your confirmed CV.
 * - "needs evidence" = practiced in a completed interview but not on your CV.
 * - "missing" = neither. A skill being absent from your CV does NOT mean you
 *   lack it — the disclaimer says so explicitly.
 * - The weekly plan uses Gemini's generateSkillPlan when a real provider is
 *   configured; otherwise a clearly-labeled template plan. Practice
 *   questions are always template-generated and labeled as such.
 *
 * POST /analyze is rate-limited (20/hr per user) because it may make one
 * LLM call. See server/lib/rateLimit.ts.
 */
import { Router } from "express";
import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../../drizzle/db.js";
import {
  cvs,
  interviewSessions,
  jobProfiles,
  type JobProfile,
} from "../../drizzle/schema.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { aiAssistLimiter } from "../lib/rateLimit.js";
import { getQuestionProvider } from "../ai/index.js";
import { AIError, AINotSupportedError } from "../ai/errors.js";
import type {
  GenerateSkillPlanResult,
  SkillPlanWeek,
} from "../ai/types.js";

const router = Router();

export const SKILL_GAP_MAX_SKILLS = 50;
export const SKILL_GAP_SKILL_MAX_LENGTH = 80;
export const SKILL_GAP_DEFAULT_WEEKS = 4;

export const SKILL_GAP_DISCLAIMER =
  "A skill listed as missing is only absent from your CV and interview history — it does not mean you lack the skill. Add it to your CV if you have it, or practice it below if you don't.";

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

/** Lowercase-trim-dedupe, preserving first-seen display form. */
export function normalizeSkills(raw: unknown[]): string[] {
  const seen = new Map<string, string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key) && trimmed.length <= SKILL_GAP_SKILL_MAX_LENGTH) {
      seen.set(key, trimmed);
    }
    if (seen.size >= SKILL_GAP_MAX_SKILLS) break;
  }
  return [...seen.values()];
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

export function validateAnalyzeInput(
  body: unknown
): ValidationResult<{
  targetRole: string;
  requiredSkills: string[];
  jobProfileId?: number;
}> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid input." };
  }
  const b = body as {
    targetRole?: unknown;
    requiredSkills?: unknown;
    jobProfileId?: unknown;
  };
  let jobProfileId: number | undefined;
  if (b.jobProfileId !== undefined) {
    const id = Number(b.jobProfileId);
    if (!Number.isInteger(id) || id <= 0) {
      return { ok: false, error: "jobProfileId must be a positive integer." };
    }
    jobProfileId = id;
  }
  const targetRole =
    typeof b.targetRole === "string" ? b.targetRole.trim() : "";
  const requiredSkills = normalizeSkills(
    Array.isArray(b.requiredSkills) ? b.requiredSkills : []
  );
  if (!targetRole && jobProfileId === undefined) {
    return {
      ok: false,
      error: "Provide a target role or a job profile.",
    };
  }
  if (targetRole.length > 200) {
    return { ok: false, error: "Target role is too long." };
  }
  if (requiredSkills.length === 0 && jobProfileId === undefined) {
    return {
      ok: false,
      error: "Provide at least one required skill, or pick a job profile.",
    };
  }
  return { ok: true, value: { targetRole, requiredSkills, jobProfileId } };
}

export interface SkillGapResult {
  skill: string;
  status: "demonstrated" | "needs-evidence" | "missing";
}

/** Priority order: missing first, then needs-evidence, then demonstrated. */
export function compareSkills(
  required: string[],
  cvSkills: string[],
  practicedSkills: string[]
): SkillGapResult[] {
  const cv = new Set(cvSkills.map((s) => s.toLowerCase()));
  const practiced = new Set(practicedSkills.map((s) => s.toLowerCase()));
  const rank: Record<SkillGapResult["status"], number> = {
    missing: 0,
    "needs-evidence": 1,
    demonstrated: 2,
  };
  return required
    .map((skill) => {
      const key = skill.toLowerCase();
      const status: SkillGapResult["status"] = cv.has(key)
        ? "demonstrated"
        : practiced.has(key)
          ? "needs-evidence"
          : "missing";
      return { skill, status };
    })
    .sort((a, b) => rank[a.status] - rank[b.status]);
}

/** Template practice questions per gap skill — always labeled as templates. */
export function practiceQuestionsFor(skill: string): string[] {
  return [
    `Explain ${skill} in your own words, as if teaching a beginner.`,
    `Describe a project or task where you used ${skill}. What was the outcome?`,
    `What is a common mistake people make with ${skill}, and how do you avoid it?`,
  ];
}

/** Template weekly plan — used when no real AI provider is configured. */
export function templateWeeklyPlan(
  gaps: string[],
  weeks: number = SKILL_GAP_DEFAULT_WEEKS
): SkillPlanWeek[] {
  const plan: SkillPlanWeek[] = [];
  if (gaps.length === 0) {
    return [
      {
        week: 1,
        focus: "Keep your edge",
        actions: [
          "Do one mock interview this week to keep demonstrated skills sharp.",
          "Add any new skills you pick up to your CV.",
        ],
      },
    ];
  }
  const perWeek = Math.max(1, Math.ceil(gaps.length / weeks));
  for (let w = 0; w < weeks; w++) {
    const chunk = gaps.slice(w * perWeek, (w + 1) * perWeek);
    if (chunk.length === 0) break;
    plan.push({
      week: w + 1,
      focus: chunk.join(", "),
      actions: chunk.flatMap((skill) => [
        `Study the fundamentals of ${skill} (docs + one tutorial).`,
        `Build a tiny practice exercise using ${skill}.`,
      ]),
    });
  }
  return plan;
}

export function ownsJobProfile(
  profile: JobProfile | null | undefined,
  userId: number
): profile is JobProfile {
  return !!profile && profile.userId === userId;
}

// ---------------------------------------------------------------------------
// Internal data access
// ---------------------------------------------------------------------------

/** Union of confirmed CV skills (user corrections win over parser output). */
async function loadCvSkills(userId: number): Promise<string[]> {
  const rows = await db
    .select({ corrected: cvs.userCorrectedJson, parsed: cvs.parsedJson })
    .from(cvs)
    .where(eq(cvs.userId, userId));
  const all: string[] = [];
  for (const row of rows) {
    const fields = row.corrected ?? row.parsed;
    if (fields && Array.isArray(fields.skills)) all.push(...fields.skills);
  }
  return normalizeSkills(all);
}

/**
 * Skills from job profiles tied to COMPLETED interview sessions —
 * "practiced", not proven.
 */
async function loadPracticedSkills(userId: number): Promise<string[]> {
  const sessions = await db
    .select({ jobProfileId: interviewSessions.jobProfileId })
    .from(interviewSessions)
    .where(
      and(
        eq(interviewSessions.userId, userId),
        eq(interviewSessions.status, "completed")
      )
    );
  const profileIds = [
    ...new Set(
      sessions
        .map((s) => s.jobProfileId)
        .filter((id): id is number => typeof id === "number")
    ),
  ];
  const all: string[] = [];
  for (const id of profileIds) {
    const rows = await db
      .select({ requiredSkills: jobProfiles.requiredSkills })
      .from(jobProfiles)
      .where(eq(jobProfiles.id, id))
      .limit(1);
    const skills = rows[0]?.requiredSkills;
    if (Array.isArray(skills)) all.push(...skills);
  }
  return normalizeSkills(all);
}

async function loadJobProfileSummaries(userId: number) {
  const rows = await db
    .select({
      id: jobProfiles.id,
      title: jobProfiles.title,
      requiredSkills: jobProfiles.requiredSkills,
    })
    .from(jobProfiles)
    .where(eq(jobProfiles.userId, userId));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    requiredSkills: Array.isArray(r.requiredSkills) ? r.requiredSkills : [],
  }));
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get(
  "/inputs",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    if (userId === null) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const [cvSkills, practicedSkills, profiles] = await Promise.all([
      loadCvSkills(userId),
      loadPracticedSkills(userId),
      loadJobProfileSummaries(userId),
    ]);
    res.json({ cvSkills, practicedSkills, jobProfiles: profiles });
  })
);

router.post(
  "/analyze",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    if (userId === null) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const rateKey = `skill-gap:${userId}`;
    if (aiAssistLimiter.isLimited(rateKey)) {
      res.set(
        "Retry-After",
        String(aiAssistLimiter.retryAfterSeconds(rateKey))
      );
      res.status(429).json({
        error:
          "Too many analyses. Please wait a while before trying again.",
      });
      return;
    }
    const checked = validateAnalyzeInput(req.body);
    if (!checked.ok || !checked.value) {
      res.status(400).json({ error: checked.error ?? "Invalid input." });
      return;
    }

    let { targetRole, requiredSkills } = checked.value;
    if (checked.value.jobProfileId !== undefined) {
      const rows = await db
        .select()
        .from(jobProfiles)
        .where(eq(jobProfiles.id, checked.value.jobProfileId))
        .limit(1);
      const profile = rows[0] ?? null;
      if (!ownsJobProfile(profile, userId)) {
        res.status(404).json({ error: "Job profile not found." });
        return;
      }
      if (!targetRole) targetRole = profile.title;
      if (requiredSkills.length === 0 && Array.isArray(profile.requiredSkills)) {
        requiredSkills = normalizeSkills(profile.requiredSkills);
      }
      if (requiredSkills.length === 0) {
        res.status(400).json({
          error: "This job profile has no required skills to compare.",
        });
        return;
      }
    }
    aiAssistLimiter.record(rateKey);

    const [cvSkills, practicedSkills] = await Promise.all([
      loadCvSkills(userId),
      loadPracticedSkills(userId),
    ]);
    const comparison = compareSkills(requiredSkills, cvSkills, practicedSkills);
    const gaps = comparison
      .filter((c) => c.status !== "demonstrated")
      .map((c) => c.skill);

    const practiceQuestions: Record<string, string[]> = {};
    for (const skill of gaps) {
      practiceQuestions[skill] = practiceQuestionsFor(skill);
    }

    // Weekly plan: real AI when configured, else an honest template plan.
    let weeklyPlan: SkillPlanWeek[];
    let planProvider: "gemini" | "template" = "template";
    const provider = getQuestionProvider();
    if (typeof provider.generateSkillPlan === "function") {
      try {
        const plan: GenerateSkillPlanResult = await provider.generateSkillPlan({
          targetRole,
          currentSkills: [...cvSkills, ...practicedSkills],
          weeks: SKILL_GAP_DEFAULT_WEEKS,
        });
        weeklyPlan = plan.weeklyPlan;
        planProvider = "gemini";
      } catch (err) {
        if (err instanceof AIError && !(err instanceof AINotSupportedError)) {
          // Real provider failed (quota/network) — template plan still helps.
        } else if (!(err instanceof AINotSupportedError)) {
          throw err;
        }
        weeklyPlan = templateWeeklyPlan(gaps);
      }
    } else {
      weeklyPlan = templateWeeklyPlan(gaps);
    }

    res.json({
      targetRole,
      comparison,
      practiceQuestions,
      practiceQuestionsNote:
        "Practice questions are template-generated starting points, not AI-personalized.",
      weeklyPlan,
      planProvider,
      disclaimer: SKILL_GAP_DISCLAIMER,
    });
  })
);

export default router;
