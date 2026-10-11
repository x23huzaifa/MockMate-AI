/**
 * Gemini provider configuration — pure, testable reader.
 *
 * Reads GEMINI_API_KEY / GEMINI_MODEL / AI_PROVIDER / AI_MODE from the
 * provided env object (defaults to process.env) at CALL time, never at
 * import time, so unit tests can set/unset variables freely.
 * `server/_core/env.ts` declares the same variables for fail-fast startup
 * documentation; the values agree.
 *
 * Deliberately does NOT import ../_core/env.js: that module throws when
 * DATABASE_URL/JWT_SECRET are missing, which would make every server/ai
 * unit test require a database. The AI layer stays environment-light.
 *
 * Selection logic (explicit opt-in — a missing key NEVER crashes startup):
 *   AI_PROVIDER=gemini AND GEMINI_API_KEY present AND AI_MODE != force-template
 *     → "gemini"
 *   otherwise → "template" (demo mode)
 */

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export type AIProviderName = "gemini" | "template";
export type AIMode = "auto" | "force-template";

export interface AiConfig {
  /** Null when GEMINI_API_KEY is unset/blank → template provider is used. */
  apiKey: string | null;
  /** Model id, e.g. "gemini-2.5-flash". Never blank. */
  model: string;
  /** Requested provider. Default "template" (explicit opt-in for Gemini). */
  provider: AIProviderName;
  /** "auto" lets a configured Gemini run; "force-template" pins templates. */
  mode: AIMode;
}

/**
 * Resolve the AI configuration. A blank/whitespace-only key counts as
 * unset (fail-closed: we never send a blank key to Google). Unknown
 * AI_PROVIDER/AI_MODE values fall back to their safe defaults.
 */
export function resolveAiConfig(
  env: NodeJS.ProcessEnv = process.env
): AiConfig {
  const rawKey = env.GEMINI_API_KEY;
  const apiKey =
    typeof rawKey === "string" && rawKey.trim().length > 0
      ? rawKey.trim()
      : null;
  const rawModel = env.GEMINI_MODEL;
  const model =
    typeof rawModel === "string" && rawModel.trim().length > 0
      ? rawModel.trim()
      : DEFAULT_GEMINI_MODEL;
  const provider: AIProviderName =
    typeof env.AI_PROVIDER === "string" &&
    env.AI_PROVIDER.trim().toLowerCase() === "gemini"
      ? "gemini"
      : "template";
  const mode: AIMode =
    typeof env.AI_MODE === "string" &&
    env.AI_MODE.trim().toLowerCase() === "force-template"
      ? "force-template"
      : "auto";
  return { apiKey, model, provider, mode };
}

/**
 * The provider actually in effect after applying the selection logic.
 * Never throws; a missing key simply yields "template".
 */
export function activeProviderName(
  env: NodeJS.ProcessEnv = process.env
): AIProviderName {
  const c = resolveAiConfig(env);
  return c.provider === "gemini" &&
    c.apiKey !== null &&
    c.mode !== "force-template"
    ? "gemini"
    : "template";
}

/** True when the Gemini LLM will actually serve requests. */
export function isGeminiConfigured(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return activeProviderName(env) === "gemini";
}

/**
 * One-line startup log describing the AI mode. Call once at boot; never
 * includes the key.
 */
export function aiStartupLine(env: NodeJS.ProcessEnv = process.env): string {
  const c = resolveAiConfig(env);
  if (activeProviderName(env) === "gemini") {
    return `AI provider: gemini (model ${c.model})`;
  }
  if (c.provider === "gemini" && c.apiKey === null) {
    return "AI provider: template/demo mode (AI_PROVIDER=gemini but GEMINI_API_KEY is missing — set GEMINI_API_KEY to enable Gemini)";
  }
  if (c.mode === "force-template") {
    return "AI provider: template/demo mode (AI_MODE=force-template pins the built-in engine)";
  }
  return "AI provider: template/demo mode (set AI_PROVIDER=gemini and GEMINI_API_KEY to enable Gemini)";
}
