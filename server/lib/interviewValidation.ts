/**
 * Pure input validators for job profiles and interviews.
 *
 * No DB access, no env access — unit-testable in isolation.
 * Language allowlists live in server/lib/languages.ts (Phase D) — each of
 * the four settings has its own honest allowlist gated by what actually
 * exists (question banks, feedback templates, keyword lists).
 */
import {
  isValidLanguageFor,
  languageSettingError,
  type LanguageSettingKey,
} from "./languages.js";

/** Back-compat alias: the interview/feedback languages accepted in Phase C. */
export const INTERVIEW_LANGUAGES = ["en", "ur", "roman-ur"] as const;
export type InterviewLanguage = (typeof INTERVIEW_LANGUAGES)[number];

export function isInterviewLanguage(value: unknown): value is InterviewLanguage {
  return (
    isValidLanguageFor("interviewLanguage", value) &&
    (INTERVIEW_LANGUAGES as readonly string[]).includes(value)
  );
}

export interface Checked<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

function fail<T>(error: string): Checked<T> {
  return { ok: false, error };
}

function ok<T>(value: T): Checked<T> {
  return { ok: true, value };
}

export interface JobProfileInput {
  title: string;
  company: string | null;
  description: string | null;
  requiredSkills: string[];
}

export function validateJobProfileInput(body: unknown): Checked<JobProfileInput> {
  if (typeof body !== "object" || body === null) {
    return fail("Invalid request body.");
  }
  const { title, company, description, requiredSkills } = body as Record<
    string,
    unknown
  >;

  if (typeof title !== "string" || title.trim().length === 0) {
    return fail("Job title is required.");
  }
  if (title.trim().length > 120) {
    return fail("Job title must be at most 120 characters.");
  }
  if (
    company !== undefined &&
    company !== null &&
    (typeof company !== "string" || company.length > 255)
  ) {
    return fail("Company must be at most 255 characters.");
  }
  if (
    description !== undefined &&
    description !== null &&
    (typeof description !== "string" || description.length > 5000)
  ) {
    return fail("Description must be at most 5000 characters.");
  }

  let skills: string[] = [];
  if (requiredSkills !== undefined && requiredSkills !== null) {
    if (!Array.isArray(requiredSkills)) {
      return fail("requiredSkills must be an array of strings.");
    }
    if (requiredSkills.length > 30) {
      return fail("requiredSkills must have at most 30 entries.");
    }
    for (const s of requiredSkills) {
      if (typeof s !== "string" || s.trim().length === 0 || s.length > 50) {
        return fail("Each skill must be a non-empty string up to 50 characters.");
      }
    }
    skills = requiredSkills.map((s: string) => s.trim());
  }

  return ok({
    title: title.trim(),
    company:
      typeof company === "string" && company.trim().length > 0
        ? company.trim()
        : null,
    description:
      typeof description === "string" && description.trim().length > 0
        ? description.trim()
        : null,
    requiredSkills: skills,
  });
}

export interface InterviewCreateInput {
  jobProfileId: number | null;
  cvId: number | null;
  interviewLanguage: string;
  responseLanguage: string;
  feedbackLanguage: string;
  evaluationLanguage: string;
  questionCount: number;
}

function parseOptionalId(value: unknown): number | null | "invalid" {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return "invalid";
  return n;
}

export function validateInterviewCreateInput(
  body: unknown
): Checked<InterviewCreateInput> {
  if (typeof body !== "object" || body === null) {
    return fail("Invalid request body.");
  }
  const {
    jobProfileId,
    cvId,
    interviewLanguage,
    responseLanguage,
    feedbackLanguage,
    evaluationLanguage,
    questionCount,
  } = body as Record<string, unknown>;

  const jp = parseOptionalId(jobProfileId);
  if (jp === "invalid") return fail("jobProfileId must be a positive integer.");
  const cv = parseOptionalId(cvId);
  if (cv === "invalid") return fail("cvId must be a positive integer.");

  const langs: Record<LanguageSettingKey, unknown> = {
    interviewLanguage:
      interviewLanguage === undefined || interviewLanguage === null
        ? "en"
        : interviewLanguage,
    responseLanguage:
      responseLanguage === undefined || responseLanguage === null
        ? "en"
        : responseLanguage,
    feedbackLanguage:
      feedbackLanguage === undefined || feedbackLanguage === null
        ? "en"
        : feedbackLanguage,
    evaluationLanguage:
      evaluationLanguage === undefined || evaluationLanguage === null
        ? "en"
        : evaluationLanguage,
  };
  for (const key of Object.keys(langs) as LanguageSettingKey[]) {
    if (!isValidLanguageFor(key, langs[key])) {
      return fail(languageSettingError(key));
    }
  }

  let count = 5;
  if (questionCount !== undefined && questionCount !== null) {
    const n = Number(questionCount);
    if (!Number.isInteger(n) || n < 3 || n > 10) {
      return fail("questionCount must be an integer between 3 and 10.");
    }
    count = n;
  }

  return ok({
    jobProfileId: jp,
    cvId: cv,
    interviewLanguage: langs.interviewLanguage as string,
    responseLanguage: langs.responseLanguage as string,
    feedbackLanguage: langs.feedbackLanguage as string,
    evaluationLanguage: langs.evaluationLanguage as string,
    questionCount: count,
  });
}

export function validateAnswerInput(body: unknown): Checked<{ answerText: string }> {
  if (typeof body !== "object" || body === null) {
    return fail("Invalid request body.");
  }
  const { answerText } = body as Record<string, unknown>;
  if (typeof answerText !== "string" || answerText.trim().length === 0) {
    return fail("Answer text is required.");
  }
  if (answerText.length > 5000) {
    return fail("Answer must be at most 5000 characters.");
  }
  return ok({ answerText });
}
