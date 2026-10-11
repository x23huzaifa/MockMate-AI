/**
 * Unit tests for interview ownership guards.
 *
 * Pure functions — no DB needed. These pin the no-IDOR contract used by
 * every per-resource endpoint: missing rows and other users' rows are both
 * treated as "not yours".
 *
 * Run: pnpm test
 * Status: WRITTEN, NOT EXECUTED in this environment (no node_modules here).
 */
import { describe, expect, it } from "vitest";
import { ownsJobProfile, ownsSession } from "./interviewGuards.js";
import type { InterviewSession, JobProfile } from "../../drizzle/schema.js";

const session = { id: 7, userId: 42 } as InterviewSession;
const profile = { id: 3, userId: 42 } as JobProfile;

describe("interview ownership guards", () => {
  it("ownsSession: true for my session", () => {
    expect(ownsSession(session, 42)).toBe(true);
  });

  it("ownsSession: false for another user's session (no IDOR)", () => {
    expect(ownsSession(session, 99)).toBe(false);
  });

  it("ownsSession: false for null/undefined rows", () => {
    expect(ownsSession(null, 42)).toBe(false);
    expect(ownsSession(undefined, 42)).toBe(false);
  });

  it("ownsJobProfile: true for mine, false for others' or missing", () => {
    expect(ownsJobProfile(profile, 42)).toBe(true);
    expect(ownsJobProfile(profile, 99)).toBe(false);
    expect(ownsJobProfile(null, 42)).toBe(false);
  });
});
