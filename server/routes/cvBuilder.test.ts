/**
 * Tests for the CV builder route helpers (server/routes/cvBuilder.ts).
 *
 * Pure functions only — no DB, no auth, no network.
 *
 * Run: pnpm test
 * Status: WRITTEN, NOT EXECUTED in this environment (no node_modules here).
 */
import { describe, expect, it } from "vitest";
import {
  assistUnconfiguredBody,
  isValidTemplate,
  ownsDocument,
  parseIdParam,
  validateAssistInput,
  validateContent,
  validateCreateInput,
} from "./cvBuilder.js";

describe("parseIdParam", () => {
  it("accepts positive integers (string or string[])", () => {
    expect(parseIdParam("3")).toBe(3);
    expect(parseIdParam(["7"])).toBe(7);
  });
  it("rejects junk", () => {
    expect(parseIdParam("abc")).toBeNull();
    expect(parseIdParam("-1")).toBeNull();
    expect(parseIdParam("0")).toBeNull();
    expect(parseIdParam("1.5")).toBeNull();
  });
});

describe("ownsDocument", () => {
  it("is false for missing rows and other users' rows (no IDOR)", () => {
    expect(ownsDocument(null, 1)).toBe(false);
    expect(ownsDocument(undefined, 1)).toBe(false);
    expect(
      ownsDocument({ id: 1, userId: 2 } as never, 1)
    ).toBe(false);
    expect(ownsDocument({ id: 1, userId: 1 } as never, 1)).toBe(true);
  });
});

describe("isValidTemplate", () => {
  it("accepts only the three templates", () => {
    expect(isValidTemplate("modern")).toBe(true);
    expect(isValidTemplate("minimal")).toBe(true);
    expect(isValidTemplate("professional")).toBe(true);
    expect(isValidTemplate("fancy")).toBe(false);
    expect(isValidTemplate(undefined)).toBe(false);
  });
});

describe("validateCreateInput", () => {
  it("defaults title and template", () => {
    const r = validateCreateInput({});
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ title: "Untitled CV", template: "modern" });
  });
  it("rejects bad titles and templates", () => {
    expect(validateCreateInput({ title: "" }).ok).toBe(false);
    expect(validateCreateInput({ title: "x".repeat(201) }).ok).toBe(false);
    expect(validateCreateInput({ template: "nope" }).ok).toBe(false);
    expect(validateCreateInput(null).ok).toBe(false);
  });
});

describe("validateContent", () => {
  const good = {
    fullName: "Ali",
    email: "a@b.c",
    phone: "",
    headline: "",
    summary: "Hi",
    targetRole: "Dev",
    skills: ["React"],
  };
  it("accepts a well-formed content object", () => {
    expect(validateContent(good).ok).toBe(true);
  });
  it("rejects non-objects and wrong shapes", () => {
    expect(validateContent(null).ok).toBe(false);
    expect(validateContent({ ...good, skills: "React" }).ok).toBe(false);
    expect(
      validateContent({ ...good, education: [{ nope: 1 }] }).ok
    ).toBe(false);
  });
});

describe("validateAssistInput", () => {
  it("accepts a valid assist request", () => {
    const r = validateAssistInput({
      section: "summary",
      userBullets: ["Built a todo app"],
      targetRole: "Dev",
    });
    expect(r.ok).toBe(true);
    expect(r.value?.section).toBe("summary");
  });
  it("rejects unknown sections, empty bullets, and bullet spam", () => {
    expect(
      validateAssistInput({ section: "nope", userBullets: ["x"] }).ok
    ).toBe(false);
    expect(
      validateAssistInput({ section: "summary", userBullets: [] }).ok
    ).toBe(false);
    expect(
      validateAssistInput({
        section: "summary",
        userBullets: Array.from({ length: 21 }, () => "x"),
      }).ok
    ).toBe(false);
  });
});

describe("assistUnconfiguredBody", () => {
  it("is honest about needing a provider", () => {
    const b = assistUnconfiguredBody();
    expect(b.error).toMatch(/AI/i);
    expect(b.hint).toContain("GEMINI_API_KEY");
  });
});
