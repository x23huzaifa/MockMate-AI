/**
 * Unit tests for provider selection (server/ai/index.ts + config.ts).
 *
 * Pins the explicit opt-in contract: Gemini serves ONLY when
 * AI_PROVIDER=gemini AND a key is present AND AI_MODE != force-template.
 * A missing key never crashes — it yields template/demo mode.
 *
 * Run: pnpm test
 * Status: WRITTEN, NOT EXECUTED in this environment (no node_modules here).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activeProviderName,
  aiStartupLine,
  resolveAiConfig,
} from "./config.js";
import {
  aiStatus,
  getAnswerEvaluator,
  getQuestionProvider,
  safeEvaluate,
  safeGenerateQuestions,
} from "./index.js";
import { GeminiAnswerEvaluator, GeminiQuestionProvider } from "./geminiProvider.js";
import {
  TemplateAnswerEvaluator,
  TemplateQuestionProvider,
} from "./templateProvider.js";
import type { GeminiClientLike } from "./geminiProvider.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

function quotaFailingClient(): GeminiClientLike {
  return {
    models: {
      generateContent: vi
        .fn()
        .mockRejectedValue({ status: 429, message: "quota" }),
    },
  };
}

describe("resolveAiConfig", () => {
  it("defaults to template/demo mode with no env set", () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    const c = resolveAiConfig();
    expect(c.provider).toBe("template");
    expect(c.apiKey).toBeNull();
    expect(c.model).toBe("gemini-2.5-flash");
    expect(c.mode).toBe("auto");
  });

  it("treats a blank key as unset", () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "   ");
    expect(resolveAiConfig().apiKey).toBeNull();
    expect(activeProviderName()).toBe("template");
  });

  it("falls back to safe defaults for unknown enum values", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("AI_MODE", "turbo");
    const c = resolveAiConfig();
    expect(c.provider).toBe("template");
    expect(c.mode).toBe("auto");
  });
});

describe("activeProviderName", () => {
  it("gemini only with provider=gemini + key + auto mode", () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "AIza-test");
    expect(activeProviderName()).toBe("gemini");
  });

  it("template when AI_MODE=force-template even with a key", () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "AIza-test");
    vi.stubEnv("AI_MODE", "force-template");
    expect(activeProviderName()).toBe("template");
  });

  it("template when provider is gemini but the key is missing", () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(activeProviderName()).toBe("template");
  });
});

describe("aiStatus", () => {
  it("reports template/demo mode without leaking anything", () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(aiStatus()).toEqual({
      configured: false,
      provider: "template",
      model: null,
    });
  });

  it("reports gemini with the model when configured", () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "AIza-test");
    vi.stubEnv("GEMINI_MODEL", "gemini-2.5-flash-lite");
    expect(aiStatus()).toEqual({
      configured: true,
      provider: "gemini",
      model: "gemini-2.5-flash-lite",
    });
  });
});

describe("getQuestionProvider / getAnswerEvaluator", () => {
  it("returns template singletons by default", () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(getQuestionProvider()).toBeInstanceOf(TemplateQuestionProvider);
    expect(getAnswerEvaluator()).toBeInstanceOf(TemplateAnswerEvaluator);
  });

  it("returns Gemini providers when fully configured", () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "AIza-test");
    expect(getQuestionProvider()).toBeInstanceOf(GeminiQuestionProvider);
    expect(getAnswerEvaluator()).toBeInstanceOf(GeminiAnswerEvaluator);
  });
});

describe("safe helpers", () => {
  const qInput = {
    jobTitle: "Frontend Dev",
    requiredSkills: ["React"],
    cvSkills: [],
    count: 3,
  };

  it("uses the template directly when unconfigured (no fallback flag)", async () => {
    const r = await safeGenerateQuestions(qInput, new TemplateQuestionProvider());
    expect(r.provider).toBe("template");
    expect(r.usedFallback).toBe(false);
    expect(r.fallbackReason).toBeNull();
    expect(r.result.length).toBeGreaterThan(0);
  });

  it("falls back to template on Gemini quota errors", async () => {
    const gemini = new GeminiQuestionProvider({
      apiKey: "AIza-test",
      client: quotaFailingClient(),
    });
    const r = await safeGenerateQuestions(qInput, gemini);
    expect(r.provider).toBe("template");
    expect(r.usedFallback).toBe(true);
    expect(r.fallbackReason).toBe("quota");
    expect(r.result.length).toBeGreaterThan(0);
  });

  it("safeEvaluate falls back to the heuristic evaluator on failure", async () => {
    const gemini = new GeminiAnswerEvaluator({
      apiKey: "AIza-test",
      client: quotaFailingClient(),
    });
    const r = await safeEvaluate(
      {
        question: "Tell me about yourself.",
        category: "introduction",
        answerText: "I am a developer with two years of experience.",
        rubricHints: [],
      },
      gemini
    );
    expect(r.provider).toBe("template");
    expect(r.usedFallback).toBe(true);
    expect(r.result.scores.relevance).toBeGreaterThanOrEqual(1);
  });
});

describe("aiStartupLine", () => {
  it("names demo mode and the fix when unconfigured", () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    const line = aiStartupLine();
    expect(line).toContain("template/demo mode");
    expect(line).toContain("GEMINI_API_KEY");
    expect(line).not.toContain("AIza");
  });

  it("names the model when Gemini is active", () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "AIza-test");
    expect(aiStartupLine()).toContain("gemini");
  });
});
