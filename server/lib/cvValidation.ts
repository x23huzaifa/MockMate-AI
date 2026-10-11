/**
 * Validators for PATCH /api/v1/cvs/:id correction bodies.
 *
 * Pure (no DB/env), unit-testable. The body may contain any subset of the
 * known CV fields; unknown keys are rejected so typos fail loudly instead
 * of being silently dropped.
 */
import type { CvFields } from "../../drizzle/schema.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_KEYS = new Set([
  "name",
  "email",
  "phone",
  "skills",
  "education",
  "experienceYears",
]);

export type CorrectionsResult =
  | { ok: true; value: Partial<CvFields> }
  | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function validateStringArray(
  value: unknown,
  maxItems: number,
  maxLen: number
): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const trimmed = item.trim();
    if (trimmed.length === 0 || trimmed.length > maxLen) return null;
    out.push(trimmed);
  }
  return out;
}

export function validateCorrections(body: unknown): CorrectionsResult {
  if (!isRecord(body)) {
    return { ok: false, error: "Invalid request body." };
  }
  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(key)) {
      return { ok: false, error: `Unknown field: "${key}".` };
    }
  }

  const value: Partial<CvFields> = {};

  if ("name" in body) {
    const v = body.name;
    if (v !== null) {
      if (typeof v !== "string" || v.trim().length < 2 || v.trim().length > 80) {
        return {
          ok: false,
          error: "Name must be between 2 and 80 characters.",
        };
      }
      value.name = v.trim();
    } else {
      value.name = null;
    }
  }

  if ("email" in body) {
    const v = body.email;
    if (v !== null) {
      if (typeof v !== "string" || !EMAIL_RE.test(v.trim())) {
        return { ok: false, error: "Please enter a valid email address." };
      }
      value.email = v.trim();
    } else {
      value.email = null;
    }
  }

  if ("phone" in body) {
    const v = body.phone;
    if (v !== null) {
      if (typeof v !== "string" || v.trim().length === 0 || v.trim().length > 32) {
        return {
          ok: false,
          error: "Phone must be between 1 and 32 characters.",
        };
      }
      value.phone = v.trim();
    } else {
      value.phone = null;
    }
  }

  if ("skills" in body) {
    const arr = validateStringArray(body.skills, 100, 60);
    if (arr === null) {
      return {
        ok: false,
        error: "Skills must be an array of up to 100 short strings.",
      };
    }
    value.skills = arr;
  }

  if ("education" in body) {
    const arr = validateStringArray(body.education, 30, 200);
    if (arr === null) {
      return {
        ok: false,
        error: "Education must be an array of up to 30 short strings.",
      };
    }
    value.education = arr;
  }

  if ("experienceYears" in body) {
    const v = body.experienceYears;
    if (v !== null) {
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 60) {
        return {
          ok: false,
          error: "Experience must be a number between 0 and 60.",
        };
      }
      value.experienceYears = v;
    } else {
      value.experienceYears = null;
    }
  }

  return { ok: true, value };
}
