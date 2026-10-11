/**
 * Unit tests for the interview state machine.
 *
 * The machine is the single source of truth for legal status transitions;
 * routes must call assertTransition before persisting a status change.
 *
 * Run: pnpm test
 * Status: WRITTEN, NOT EXECUTED in this environment (no node_modules here).
 */
import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  isInterviewStatus,
  StateError,
} from "./interviewState.js";

describe("interview state machine", () => {
  it("allows the happy path: created → asking → awaiting_answer → evaluating → completed", () => {
    expect(canTransition("created", "asking")).toBe(true);
    expect(canTransition("asking", "awaiting_answer")).toBe(true);
    expect(canTransition("awaiting_answer", "evaluating")).toBe(true);
    expect(canTransition("evaluating", "awaiting_answer")).toBe(true);
    expect(canTransition("evaluating", "completed")).toBe(true);
    expect(() => assertTransition("created", "asking")).not.toThrow();
  });

  it("allows pause/resume from any active state", () => {
    for (const from of [
      "created",
      "asking",
      "awaiting_answer",
      "evaluating",
    ] as const) {
      expect(canTransition(from, "paused")).toBe(true);
      expect(canTransition(from, "interrupted")).toBe(true);
      expect(canTransition(from, "failed")).toBe(true);
    }
    expect(canTransition("paused", "awaiting_answer")).toBe(true);
  });

  it("rejects answering before a question is presented", () => {
    // created → evaluating skips asking/awaiting_answer: illegal.
    expect(canTransition("created", "evaluating")).toBe(false);
    expect(canTransition("asking", "evaluating")).toBe(false);
    expect(() => assertTransition("asking", "evaluating")).toThrow(StateError);
  });

  it("rejects submitting an answer twice for the same state", () => {
    // evaluating → evaluating is not a legal move (double-submit guard).
    expect(canTransition("evaluating", "evaluating")).toBe(false);
  });

  it("makes completed / interrupted / failed terminal", () => {
    for (const terminal of ["completed", "interrupted", "failed"] as const) {
      for (const to of [
        "created",
        "asking",
        "awaiting_answer",
        "evaluating",
        "completed",
        "paused",
        "interrupted",
        "failed",
      ] as const) {
        expect(canTransition(terminal, to)).toBe(false);
      }
    }
  });

  it("rejects resume from non-paused states", () => {
    expect(canTransition("awaiting_answer", "awaiting_answer")).toBe(false);
    expect(canTransition("created", "awaiting_answer")).toBe(false);
    expect(() => assertTransition("created", "awaiting_answer")).toThrow(
      /Illegal interview transition: created → awaiting_answer/
    );
  });

  it("validates status strings", () => {
    expect(isInterviewStatus("awaiting_answer")).toBe(true);
    expect(isInterviewStatus("completed")).toBe(true);
    expect(isInterviewStatus("nonsense")).toBe(false);
    expect(isInterviewStatus(null)).toBe(false);
    expect(isInterviewStatus(42)).toBe(false);
  });
});
