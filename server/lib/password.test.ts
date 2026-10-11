/**
 * Unit tests for bcrypt password hashing.
 * Pure functions — no DB, no env needed.
 *
 * Run: pnpm test
 * Status: WRITTEN, NOT EXECUTED in this environment (no node_modules here).
 */
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing (bcrypt, 12 rounds)", () => {
  it("hashes and verifies the correct password", async () => {
    const hash = await hashPassword("correct-horse-battery-9");
    expect(await verifyPassword("correct-horse-battery-9", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct-horse-battery-9");
    expect(await verifyPassword("wrong-password-123", hash)).toBe(false);
  });

  it("produces a different hash each time (unique salt per hash)", async () => {
    const a = await hashPassword("same-password-123");
    const b = await hashPassword("same-password-123");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same-password-123", a)).toBe(true);
    expect(await verifyPassword("same-password-123", b)).toBe(true);
  }, 30000); // bcrypt-12 is slow on low-end hardware; 5s default is too tight

  it("never embeds the plaintext in the hash", async () => {
    const hash = await hashPassword("plaintext-secret-1");
    expect(hash).not.toContain("plaintext-secret-1");
  });
});
