/**
 * Tests for the skill gap route helpers (server/routes/skillGap.ts).
 *
 * Pure functions only — no DB, no auth, no network.
 *
 * Run: pnpm test
 * Status: WRITTEN, NOT EXECUTED in this environment (no node_modules here).
 */
import { describe, expect, it } from "vitest";
import {
  SKILL_GAP_DISCLAIMER,
  compareSkills,
  normalizeSkills,
  ownsJobProfile,
  practiceQuestionsFor,
  templateWeeklyPlan,
  validateAnalyzeInput,
} from "./skillGap.js";

describe("normalizeSkills", () => {
  it("lowercase-dedupes and trims", () => {
    expect(normalizeSkills(["React", " react ", "PYTHON", 42 as never])).toEqual([
      "React",
      "PYTHON",
    ]);
  });
  it("drops empties", () => {
    expect(normalizeSkills(["", "  ", "Go"])).toEqual(["Go"]);
  });
});

describe("validateAnalyzeInput", () => {
  it("accepts role + skills", () => {
    const r = validateAnalyzeInput({
      targetRole: "Dev",
      requiredSkills: ["React", "Git"],
    });
    expect(r.ok).toBe(true);
  });
  it("accepts a job profile id alone", () => {
    expect(validateAnalyzeInput({ jobProfileId: 5 }).ok).toBe(true);
  });
  it("rejects empty input and junk ids", () => {
    expect(validateAnalyzeInput({}).ok).toBe(false);
    expect(
      validateAnalyzeInput({ targetRole: "Dev", requiredSkills: [] }).ok
    ).toBe(false);
    expect(validateAnalyzeInput({ jobProfileId: -2 }).ok).toBe(false);
  });
});

describe("compareSkills", () => {
  it("classifies demonstrated / needs-evidence / missing in priority order", () => {
    const out = compareSkills(
      ["React", "Docker", "GraphQL"],
      ["react"],
      ["docker"]
    );
    expect(out).toEqual([
      { skill: "GraphQL", status: "missing" },
      { skill: "Docker", status: "needs-evidence" },
      { skill: "React", status: "demonstrated" },
    ]);
  });
  it("is case-insensitive", () => {
    const out = compareSkills(["REACT"], ["react"], []);
    expect(out[0].status).toBe("demonstrated");
  });
});

describe("practiceQuestionsFor", () => {
  it("returns three template questions mentioning the skill", () => {
    const qs = practiceQuestionsFor("Kubernetes");
    expect(qs).toHaveLength(3);
    for (const q of qs) expect(q).toContain("Kubernetes");
  });
});

describe("templateWeeklyPlan", () => {
  it("distributes gaps across weeks", () => {
    const plan = templateWeeklyPlan(["A", "B", "C", "D", "E"], 2);
    expect(plan).toHaveLength(2);
    expect(plan[0].week).toBe(1);
    expect(plan[0].actions.length).toBeGreaterThan(0);
  });
  it("returns a keep-sharp plan when there are no gaps", () => {
    const plan = templateWeeklyPlan([]);
    expect(plan).toHaveLength(1);
    expect(plan[0].focus).toMatch(/edge/i);
  });
});

describe("ownsJobProfile", () => {
  it("is false for missing rows and other users' rows (no IDOR)", () => {
    expect(ownsJobProfile(null, 1)).toBe(false);
    expect(ownsJobProfile({ id: 1, userId: 9 } as never, 1)).toBe(false);
    expect(ownsJobProfile({ id: 1, userId: 1 } as never, 1)).toBe(true);
  });
});

describe("SKILL_GAP_DISCLAIMER", () => {
  it("says absence is not proof of lacking the skill", () => {
    expect(SKILL_GAP_DISCLAIMER).toMatch(/does not mean you lack/i);
  });
});
