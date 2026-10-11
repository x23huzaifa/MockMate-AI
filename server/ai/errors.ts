/**
 * Typed AI provider errors.
 *
 * Callers (safe helpers, routes) switch on these instead of parsing SDK
 * message strings. The safe helpers in server/ai/index.ts catch AIError
 * and fall back to the template provider; anything else propagates as a
 * programming bug.
 *
 * PRIVACY: never attach prompt contents, answers, or the API key to these
 * errors — they may be logged by the global error handler.
 */

/** Base class for expected AI provider failures (safe to fall back). */
export class AIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIError";
  }
}

/**
 * The provider refused or throttled the request (HTTP 429 /
 * RESOURCE_EXHAUSTED). Callers should tell the user "AI is busy, try again
 * in a moment" and continue with the template fallback.
 */
export class AIQuotaExceededError extends AIError {
  constructor() {
    super("AI quota exceeded (rate limit).");
    this.name = "AIQuotaExceededError";
  }
}

/**
 * The provider cannot be used: missing/invalid API key, or the chat
 * endpoint was hit with no provider configured. Never silently fall back
 * for chat — the user must see the honest "not configured" message.
 */
export class AIConfigError extends AIError {
  constructor(message = "AI provider is not configured.") {
    super(message);
    this.name = "AIConfigError";
  }
}

/**
 * The provider answered, but the response was unusable: malformed JSON,
 * wrong shape, or a timeout. Callers fall back to the template provider.
 */
export class AIResponseError extends AIError {
  constructor(message = "AI provider returned an unusable response.") {
    super(message);
    this.name = "AIResponseError";
  }
}

/**
 * The requested capability is only available with a configured AI provider
 * (e.g. CV analysis on the template engine). The template provider throws
 * this instead of faking output. Note: this extends AIError so generic
 * "try AI, fall back" helpers treat it as a safe, expected failure — but
 * there is no template equivalent to fall back TO for these capabilities,
 * so callers surface it as "not available in demo mode".
 */
export class AINotSupportedError extends AIError {
  constructor(
    message = "This capability is only available with a configured AI provider."
  ) {
    super(message);
    this.name = "AINotSupportedError";
  }
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function statusOf(err: unknown): number | null {
  if (typeof err === "object" && err !== null) {
    const maybe = err as { status?: unknown; code?: unknown };
    if (typeof maybe.status === "number") return maybe.status;
    if (typeof maybe.code === "number") return maybe.code;
  }
  return null;
}

/**
 * Map a raw SDK/transport throw to a typed AIError. Unknown throwables
 * become AIResponseError (still safe to fall back); only non-Error,
 * non-AI failures the caller explicitly wants to propagate should bypass
 * this function.
 */
export function mapGeminiError(err: unknown): AIError {
  if (err instanceof AIError) return err;
  const status = statusOf(err);
  const msg = messageOf(err).toLowerCase();
  if (
    status === 429 ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("429")
  ) {
    return new AIQuotaExceededError();
  }
  if (
    status === 401 ||
    status === 403 ||
    msg.includes("api_key_invalid") ||
    msg.includes("api key") ||
    msg.includes("unauthenticated") ||
    msg.includes("permission_denied")
  ) {
    return new AIConfigError(
      "Gemini rejected the API key. Check GEMINI_API_KEY (see AI_SETUP.md)."
    );
  }
  return new AIResponseError(`Gemini request failed: ${messageOf(err)}`);
}
