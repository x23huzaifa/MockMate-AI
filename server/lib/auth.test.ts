/**
 * Unit tests for jose HS256 session tokens.
 *
 * env.ts validates required variables AT IMPORT TIME, so the secrets below
 * must be set BEFORE the env-dependent modules load — hence the dynamic
 * import. These are throwaway test-only values, never production secrets.
 *
 * Run: pnpm test
 * Status: WRITTEN, NOT EXECUTED in this environment (no node_modules here).
 */
import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";

const TEST_SECRET = "test-jwt-secret-0123456789abcdef"; // 40 chars (min 32)
process.env.JWT_SECRET = TEST_SECRET;
process.env.DATABASE_URL = "mysql://test:test@localhost:3306/test_db";

// Top-level await: env vars above are assigned before this import evaluates.
const { signSession, verifySession } = await import("./auth.js");

describe("session tokens (jose HS256)", () => {
  it("sign/verify round-trips the payload", async () => {
    const token = await signSession({ userId: 42, role: "user" });
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // header.payload.signature
    expect(await verifySession(token)).toEqual({ userId: 42, role: "user" });
  });

  it("rejects a tampered token", async () => {
    const token = await signSession({ userId: 42, role: "user" });
    const last = token.slice(-1);
    const tampered = token.slice(0, -1) + (last === "a" ? "b" : "a");
    expect(await verifySession(tampered)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({ userId: 7, role: "user" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10) // 10s ago
      .sign(new TextEncoder().encode(TEST_SECRET));
    expect(await verifySession(expired)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const foreign = await new SignJWT({ userId: 7, role: "user" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("a-different-32-char-secret-000000"));
    expect(await verifySession(foreign)).toBeNull();
  });

  it("rejects garbage input without throwing", async () => {
    expect(await verifySession("not-a-token")).toBeNull();
    expect(await verifySession("")).toBeNull();
  });
});
