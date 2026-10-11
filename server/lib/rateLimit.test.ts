/**
 * Unit tests for the in-memory fixed-window rate limiter.
 *
 * Time is injected (no fake timers needed): 5 hits per IP per hour are
 * allowed, the 6th is blocked, hits older than the window don't count,
 * and different IPs have independent quotas.
 *
 * Run: pnpm test
 * Status: WRITTEN, NOT EXECUTED in this environment (no node_modules here).
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  AUTH_RATE_LIMIT_MAX_HITS,
  AUTH_RATE_LIMIT_WINDOW_MS,
  authLimiter,
  createRateLimiter,
  isRateLimited,
  RATE_LIMIT_MAX_HITS,
  RATE_LIMIT_WINDOW_MS,
  recordHit,
  resetRateLimit,
} from "./rateLimit.js";

describe("rate limiter (5/hour per key)", () => {
  beforeEach(() => {
    resetRateLimit();
  });

  it("allows up to 5 hits, blocks the 6th", () => {
    const t = 1_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX_HITS; i++) {
      expect(isRateLimited("1.2.3.4", t + i)).toBe(false);
      recordHit("1.2.3.4", t + i);
    }
    expect(isRateLimited("1.2.3.4", t + RATE_LIMIT_MAX_HITS)).toBe(true);
  });

  it("window resets after one hour", () => {
    const t = 1_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX_HITS; i++) recordHit("1.2.3.4", t);
    expect(isRateLimited("1.2.3.4", t + 1000)).toBe(true);
    // Just past the window edge, old hits no longer count.
    expect(isRateLimited("1.2.3.4", t + RATE_LIMIT_WINDOW_MS + 1)).toBe(false);
  });

  it("quotas are independent per key (IP)", () => {
    const t = 1_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX_HITS; i++) recordHit("1.2.3.4", t);
    expect(isRateLimited("1.2.3.4", t)).toBe(true);
    expect(isRateLimited("5.6.7.8", t)).toBe(false);
  });

  it("hits exactly at the window boundary are expired", () => {
    const t = 1_000_000;
    recordHit("1.2.3.4", t);
    // A hit at exactly now - WINDOW_MS is NOT within the window (t > cutoff).
    expect(isRateLimited("1.2.3.4", t + RATE_LIMIT_WINDOW_MS)).toBe(false);
    expect(isRateLimited("1.2.3.4", t + RATE_LIMIT_WINDOW_MS - 1)).toBe(false);
  });

  it("recordHit returns the key to a clean state after reset", () => {
    recordHit("9.9.9.9");
    resetRateLimit();
    expect(isRateLimited("9.9.9.9")).toBe(false);
  });
});

describe("createRateLimiter factory (auth: 10 / 15 min)", () => {
  it("auth limiter allows 10 hits, blocks the 11th", () => {
    authLimiter.reset();
    const t = 2_000_000;
    for (let i = 0; i < AUTH_RATE_LIMIT_MAX_HITS; i++) {
      expect(authLimiter.isLimited("9.9.9.9", t + i)).toBe(false);
      authLimiter.record("9.9.9.9", t + i);
    }
    expect(authLimiter.isLimited("9.9.9.9", t + AUTH_RATE_LIMIT_MAX_HITS)).toBe(
      true
    );
    authLimiter.reset();
  });

  it("auth window is 15 minutes", () => {
    expect(AUTH_RATE_LIMIT_WINDOW_MS).toBe(15 * 60 * 1000);
  });

  it("retryAfterSeconds returns 0 when not limited, positive when limited", () => {
    const limiter = createRateLimiter(2, 60_000);
    const t = 3_000_000;
    expect(limiter.retryAfterSeconds("k", t)).toBe(0);
    limiter.record("k", t);
    limiter.record("k", t + 1000);
    expect(limiter.isLimited("k", t + 1000)).toBe(true);
    // Oldest hit at t expires at t + 60s → ~59s remaining from t+1000.
    expect(limiter.retryAfterSeconds("k", t + 1000)).toBe(59);
  });

  it("independent limiter instances do not share state", () => {
    const a = createRateLimiter(1, 60_000);
    const b = createRateLimiter(1, 60_000);
    a.record("k");
    expect(a.isLimited("k")).toBe(true);
    expect(b.isLimited("k")).toBe(false);
  });
});
