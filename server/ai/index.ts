/**
 * AI provider wiring.
 *
 * Two engines, one interface:
 * - "template": deterministic local engine (server/ai/templateProvider.ts),
 *   honestly labeled. Always available.
 * - "gemini": Google Gemini LLM (server/ai/geminiProvider.ts), used only
 *   when explicitly enabled (AI_PROVIDER=gemini) AND GEMINI_API_KEY is set
 *   AND AI_MODE is not "force-template". See server/ai/config.ts.
 *
 * The legacy `questionProvider` / `answerEvaluator` singleton exports stay
 * as the template pair (backward compatible). New code should use
 * getQuestionProvider() / getAnswerEvaluator() / the safe* helpers, which
 * honor the env selection and fall back to the template engine when Gemini
 * fails with an expected AIError (quota, config, bad response, network) —
 * an interview session never hard-fails because the LLM hiccuped.
 */
import type {
  AnswerEvaluator,
  EvaluationInput,
  EvaluationResult,
  GeneratedQuestion,
  QuestionGenerationInput,
  QuestionProvider,
} from "./types.js";
import {
  activeProviderName,
  resolveAiConfig,
  type AIProviderName,
} from "./config.js";
import { AIError, AIQuotaExceededError } from "./errors.js";
import {
  TemplateAnswerEvaluator,
  TemplateQuestionProvider,
} from "./templateProvider.js";
import {
  GeminiAnswerEvaluator,
  GeminiQuestionProvider,
} from "./geminiProvider.js";

// Legacy singletons — template engine, kept for backward compatibility.
export const questionProvider: QuestionProvider =
  new TemplateQuestionProvider();
export const answerEvaluator: AnswerEvaluator = new TemplateAnswerEvaluator();

export interface AIStatus {
  configured: boolean;
  provider: AIProviderName;
  model: string | null;
}

/** Provider actually in effect (never throws, never leaks the key). */
export function aiStatus(env: NodeJS.ProcessEnv = process.env): AIStatus {
  const provider = activeProviderName(env);
  const { model } = resolveAiConfig(env);
  return {
    configured: provider === "gemini",
    provider,
    model: provider === "gemini" ? model : null,
  };
}

function geminiQuestionProvider(env: NodeJS.ProcessEnv): QuestionProvider {
  const { apiKey, model } = resolveAiConfig(env);
  // apiKey is non-null here: activeProviderName() already checked it.
  return new GeminiQuestionProvider({ apiKey: apiKey as string, model });
}

function geminiAnswerEvaluator(env: NodeJS.ProcessEnv): AnswerEvaluator {
  const { apiKey, model } = resolveAiConfig(env);
  return new GeminiAnswerEvaluator({ apiKey: apiKey as string, model });
}

/** Question provider honoring AI_PROVIDER / AI_MODE / key presence. */
export function getQuestionProvider(
  env: NodeJS.ProcessEnv = process.env
): QuestionProvider {
  return activeProviderName(env) === "gemini"
    ? geminiQuestionProvider(env)
    : questionProvider;
}

/** Answer evaluator honoring AI_PROVIDER / AI_MODE / key presence. */
export function getAnswerEvaluator(
  env: NodeJS.ProcessEnv = process.env
): AnswerEvaluator {
  return activeProviderName(env) === "gemini"
    ? geminiAnswerEvaluator(env)
    : answerEvaluator;
}

export type FallbackReason = "quota" | "config" | "response" | "network" | null;

export interface SafeResult<T> {
  result: T;
  /** The engine that actually produced `result`. */
  provider: AIProviderName;
  /** True when the template engine filled in for a failed Gemini call. */
  usedFallback: boolean;
  fallbackReason: FallbackReason;
}

function fallbackReasonOf(err: AIError): FallbackReason {
  if (err instanceof AIQuotaExceededError) return "quota";
  const msg = err.message.toLowerCase();
  if (msg.includes("not configured") || msg.includes("api key"))
    return "config";
  if (
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("econn") ||
    msg.includes("timeout")
  )
    return "network";
  return "response";
}

/**
 * Generate questions via the active provider; on any expected AI failure,
 * fall back to the template engine. Never throws AIError.
 */
export async function safeGenerateQuestions(
  input: QuestionGenerationInput,
  provider: QuestionProvider = getQuestionProvider()
): Promise<SafeResult<GeneratedQuestion[]>> {
  try {
    const result = await provider.generateQuestions(input);
    return {
      result,
      provider:
        provider instanceof GeminiQuestionProvider ? "gemini" : "template",
      usedFallback: false,
      fallbackReason: null,
    };
  } catch (err) {
    if (!(err instanceof AIError)) throw err;
    const result = await questionProvider.generateQuestions(input);
    return {
      result,
      provider: "template",
      usedFallback: true,
      fallbackReason: fallbackReasonOf(err),
    };
  }
}

/**
 * Evaluate an answer via the active provider; on any expected AI failure,
 * fall back to the heuristic template evaluator. Never throws AIError.
 */
export async function safeEvaluate(
  input: EvaluationInput,
  evaluator: AnswerEvaluator = getAnswerEvaluator()
): Promise<SafeResult<EvaluationResult>> {
  try {
    const result = await evaluator.evaluate(input);
    return {
      result,
      provider:
        evaluator instanceof GeminiAnswerEvaluator ? "gemini" : "template",
      usedFallback: false,
      fallbackReason: null,
    };
  } catch (err) {
    if (!(err instanceof AIError)) throw err;
    const result = await answerEvaluator.evaluate(input);
    return {
      result,
      provider: "template",
      usedFallback: true,
      fallbackReason: fallbackReasonOf(err),
    };
  }
}

export type { QuestionProvider, AnswerEvaluator } from "./types.js";
export { activeProviderName, aiStartupLine } from "./config.js";
export type { AIProviderName } from "./config.js";
