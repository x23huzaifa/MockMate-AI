/**
 * Ownership guards for interview resources.
 *
 * Pure functions (no DB, no env) — unit-testable in isolation.
 * Every per-resource endpoint returns 404 "not found" for both missing
 * rows and other users' rows (no IDOR leak).
 */
import type { InterviewSession, JobProfile } from "../../drizzle/schema.js";

export function ownsJobProfile(
  row: JobProfile | null | undefined,
  userId: number
): row is JobProfile {
  return !!row && row.userId === userId;
}

export function ownsSession(
  row: InterviewSession | null | undefined,
  userId: number
): row is InterviewSession {
  return !!row && row.userId === userId;
}
