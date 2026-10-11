/**
 * Tests for the English practice route helpers (server/routes/englishPractice.ts).
 *
 * Pure functions only — no DB, no auth, no network.
 *
 * Run: pnpm test
 * Status: WRITTEN, NOT EXECUTED in this environment (no node_modules here).
 */
import { describe, expect, it } from "vitest";
import {
  EXERCISE_TYPES,
  parseSectionedReply,
  templateFeedback,
  validateAttemptInput,
} from "./englishPractice.js";

describe("validateAttemptInput", () => {
  const good = {
    exerciseType: "grammar",
    prompt: "Write three sentences.",
    userText: "I study computer science.",
  };
  it("accepts a valid attempt", () => {
    const r = validateAttemptInput(good);
    expect(r.ok).toBe(true);
    expect(r.value?.exerciseType).toBe("grammar");
  });
  it("rejects bad types, empty text, and oversize input", () => {
    expect(
      validateAttemptInput({ ...good, exerciseType: "nope" }).ok
    ).toBe(false);
    expect(validateAttemptInput({ ...good, userText: "  " }).ok).toBe(false);
    expect(
      validateAttemptInput({ ...good, userText: "x".repeat(3001) }).ok
    ).toBe(false);
    expect(
      validateAttemptInput({ ...good, language: "fr" }).ok
    ).toBe(false);
  });
  it("accepts the three supported feedback languages", () => {
    for (const t of EXERCISE_TYPES) {
      expect(
        validateAttemptInput({
          exerciseType: t,
          prompt: "p",
          userText: "hello world.",
        }).ok
      ).toBe(true);
    }
  });
});

describe("templateFeedback", () => {
  it("is labeled template and catches mechanics", () => {
    const f = templateFeedback("i love  coding");
    expect(f.provider).toBe("template");
    expect(f.corrections.length).toBeGreaterThan(0);
    expect(f.improvedVersion).toContain("I love coding.");
  });
  it("finds nothing to fix in clean text (honestly)", () => {
    const f = templateFeedback("I love coding.");
    expect(f.corrections.join(" ")).toMatch(/no mechanical issues/i);
  });
});

describe("parseSectionedReply", () => {
  it("parses the CORRECTIONS/IMPROVED/TIPS format", () => {
    const reply = `CORRECTIONS:
- "i" should be "I".
IMPROVED:
I love coding.
TIPS:
- Read aloud.`;
    const f = parseSectionedReply(reply);
    expect(f.provider).toBe("gemini");
    expect(f.corrections).toHaveLength(1);
    expect(f.improvedVersion).toBe("I love coding.");
    expect(f.tips).toHaveLength(1);
  });
  it("falls back gracefully on unformatted replies", () => {
    const f = parseSectionedReply("Just some freeform text.");
    expect(f.provider).toBe("gemini");
    expect(f.corrections).toHaveLength(1);
    expect(f.improvedVersion).toBeNull();
  });
});
