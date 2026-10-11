/**
 * Unit tests for the Phase D language registry (server/lib/languages.ts).
 *
 * These tests pin the honesty contract: every setting only accepts codes
 * for which that setting's capability actually exists, and the catalog
 * never inflates a support level.
 *
 * Run: pnpm test
 * Status: WRITTEN, NOT EXECUTED in this environment (no node_modules here).
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE_SETTINGS,
  isKnownLanguageCode,
  isValidLanguageFor,
  languageInfo,
  LANGUAGE_SETTING_KEYS,
  SUPPORTED_LANGUAGE_CODES,
} from "./languages.js";

describe("language registry", () => {
  it("contains the 8 mandated codes, each with a support level and note", () => {
    const codes = SUPPORTED_LANGUAGE_CODES.map((l) => l.code);
    for (const expected of [
      "en",
      "ur",
      "roman-ur",
      "pa-roman",
      "ps",
      "sd",
      "skb",
      "bal",
    ]) {
      expect(codes).toContain(expected);
    }
    for (const lang of SUPPORTED_LANGUAGE_CODES) {
      expect(["verified", "partial", "experimental", "unsupported"]).toContain(
        lang.supportLevel
      );
      expect(lang.note.length).toBeGreaterThan(0);
      expect(["ltr", "rtl"]).toContain(lang.direction);
    }
  });

  it("marks only en as verified — nothing is inflated", () => {
    const verified = SUPPORTED_LANGUAGE_CODES.filter(
      (l) => l.supportLevel === "verified"
    ).map((l) => l.code);
    expect(verified).toEqual(["en"]);
  });

  it("marks ur and roman-ur as partial, the rest as experimental", () => {
    expect(languageInfo("ur")?.supportLevel).toBe("partial");
    expect(languageInfo("roman-ur")?.supportLevel).toBe("partial");
    for (const code of ["pa-roman", "ps", "sd", "skb", "bal"]) {
      expect(languageInfo(code)?.supportLevel).toBe("experimental");
    }
  });

  it("marks Urdu-script languages as rtl", () => {
    expect(languageInfo("ur")?.direction).toBe("rtl");
    expect(languageInfo("ps")?.direction).toBe("rtl");
    expect(languageInfo("sd")?.direction).toBe("rtl");
    expect(languageInfo("en")?.direction).toBe("ltr");
    expect(languageInfo("roman-ur")?.direction).toBe("ltr");
  });

  it("returns null / false for unknown codes", () => {
    expect(languageInfo("xx")).toBeNull();
    expect(isKnownLanguageCode("xx")).toBe(false);
    expect(isKnownLanguageCode(42)).toBe(false);
    expect(isKnownLanguageCode(null)).toBe(false);
  });
});

describe("per-setting allowlists", () => {
  it("interview/feedback/evaluation only accept en, ur, roman-ur", () => {
    for (const setting of [
      "interviewLanguage",
      "feedbackLanguage",
      "evaluationLanguage",
    ] as const) {
      expect(isValidLanguageFor(setting, "en")).toBe(true);
      expect(isValidLanguageFor(setting, "ur")).toBe(true);
      expect(isValidLanguageFor(setting, "roman-ur")).toBe(true);
      expect(isValidLanguageFor(setting, "ps")).toBe(false);
      expect(isValidLanguageFor(setting, "xx")).toBe(false);
      expect(isValidLanguageFor(setting, "")).toBe(false);
    }
  });

  it("responseLanguage accepts all 8 codes (permissive by design)", () => {
    for (const lang of SUPPORTED_LANGUAGE_CODES) {
      expect(isValidLanguageFor("responseLanguage", lang.code)).toBe(true);
    }
    expect(isValidLanguageFor("responseLanguage", "xx")).toBe(false);
  });

  it("rejects non-string input for every setting", () => {
    for (const setting of LANGUAGE_SETTING_KEYS) {
      expect(isValidLanguageFor(setting, null)).toBe(false);
      expect(isValidLanguageFor(setting, undefined)).toBe(false);
      expect(isValidLanguageFor(setting, 42)).toBe(false);
    }
  });

  it("defaults are all English", () => {
    expect(DEFAULT_LANGUAGE_SETTINGS).toEqual({
      interviewLanguage: "en",
      responseLanguage: "en",
      feedbackLanguage: "en",
      evaluationLanguage: "en",
    });
  });
});
