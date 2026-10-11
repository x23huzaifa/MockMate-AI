/**
 * Tiny in-memory fixed-window rate limiters.
 *
 * SINGLE-INSTANCE ONLY: hits live in a process-local Map, so limits are
 * per server process (documented in README — fine for this app's scale;
 * a multi-instance deploy would need a shared store). Old timestamps are
 * pruned lazily on each check/record; no timers, no cleanup thread.
 *
 * `createRateLimiter` builds an independent limiter; the contact-form
 * limiter below is the default instance (kept as module-level functions
 * for backward compatibility with existing tests). The auth limiter guards
 * login/register against credential stuffing (10 attempts / 15 min / IP).
 *
 * Pure functions over an injectable `now` — unit-testable without timers.
 */

export interface RateLimiter {
  /** True when `key` has used up its quota in the current window. */
  isLimited(key: string, now?: number): boolean;
  /** Record one hit for `key`. */
  record(key: string, now?: number): void;
  /**
   * Seconds until the oldest hit in the current window expires (for the
   * Retry-After response header). 0 when the key is not limited.
   */
  retryAfterSeconds(key: string, now?: number): number;
  /** Test-only: clear all recorded hits. */
  reset(): void;
}

export function createRateLimiter(
  maxHits: number,
  windowMs: number
): RateLimiter {
  const hits = new Map<string, number[]>();

  function prune(key: string, now: number): number[] {
    const cutoff = now - windowMs;
    const arr = hits.get(key) ?? [];
    const kept = arr.filter((t) => t > cutoff);
    if (kept.length === 0) {
      hits.delete(key);
    } else {
      hits.set(key, kept);
    }
    return kept;
  }

  return {
    isLimited(key: string, now: number = Date.now()): boolean {
      return prune(key, now).length >= maxHits;
    },
    record(key: string, now: number = Date.now()): void {
      const kept = prune(key, now);
      kept.push(now);
      hits.set(key, kept);
    },
    retryAfterSeconds(key: string, now: number = Date.now()): number {
      const kept = prune(key, now);
      if (kept.length < maxHits) return 0;
      const oldest = Math.min(...kept);
      return Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    },
    reset(): void {
      hits.clear();
    },
  };
}

// ---------------------------------------------------------------------------
// Contact form: 5 submissions per hour per IP (public endpoint).
// ---------------------------------------------------------------------------

export const RATE_LIMIT_MAX_HITS = 5;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const contactLimiter = createRateLimiter(
  RATE_LIMIT_MAX_HITS,
  RATE_LIMIT_WINDOW_MS
);

/** True when `key` has already used up its quota in the current window. */
export function isRateLimited(key: string, now?: number): boolean {
  return contactLimiter.isLimited(key, now);
}

/** Record one hit for `key` in the current window. */
export function recordHit(key: string, now?: number): void {
  contactLimiter.record(key, now);
}

/** Seconds until `key`'s oldest hit expires (Retry-After header value). */
export function retryAfterSeconds(key: string, now?: number): number {
  return contactLimiter.retryAfterSeconds(key, now);
}

/** Test-only: clear all recorded hits. */
export function resetRateLimit(): void {
  contactLimiter.reset();
}

// ---------------------------------------------------------------------------
// Auth endpoints: 10 attempts per 15 minutes per IP (login + register).
// ---------------------------------------------------------------------------

export const AUTH_RATE_LIMIT_MAX_HITS = 10;
export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const authLimiter = createRateLimiter(
  AUTH_RATE_LIMIT_MAX_HITS,
  AUTH_RATE_LIMIT_WINDOW_MS
);

// ---------------------------------------------------------------------------
// AI chat: 30 requests per hour per user (each message = one LLM call).
// Keyed by user id (authenticated endpoint), not IP.
// ---------------------------------------------------------------------------

export const CHAT_RATE_LIMIT_MAX_HITS = 30;
export const CHAT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export const chatLimiter = createRateLimiter(
  CHAT_RATE_LIMIT_MAX_HITS,
  CHAT_RATE_LIMIT_WINDOW_MS
);

// ---------------------------------------------------------------------------
// AI-assist endpoints (CV builder section assist, skill plans): 20 calls per
// hour per user. Each call = one LLM request; keeps the shared free-tier
// quota (Gemini ~1,500 req/day) usable for everyone.
// Keyed by user id (authenticated endpoints), not IP.
// ---------------------------------------------------------------------------

export const AI_ASSIST_RATE_LIMIT_MAX_HITS = 20;
export const AI_ASSIST_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export const aiAssistLimiter = createRateLimiter(
  AI_ASSIST_RATE_LIMIT_MAX_HITS,
  AI_ASSIST_RATE_LIMIT_WINDOW_MS
);
