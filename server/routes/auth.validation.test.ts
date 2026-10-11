/**
 * Unit tests for the pure auth input validators (server/lib/validation.ts).
 * No DB, no env — fast and deterministic.
 *
 * Run: pnpm test
 * Status: WRITTEN, NOT EXECUTED in this environment (no node_modules here).
 */
import { describe, expect, it } from "vitest";
import {
  validateEmail,
  validateLoginInput,
  validateName,
  validatePassword,
  validateRegisterInput,
} from "../lib/validation.js";

describe("validateName", () => {
  it("accepts a normal name", () => {
    expect(validateName("Ali Raza")).toBeNull();
  });
  it("rejects too-short names", () => {
    expect(validateName("A")).not.toBeNull();
    expect(validateName("")).not.toBeNull();
    expect(validateName("  ")).not.toBeNull();
  });
  it("rejects too-long names", () => {
    expect(validateName("x".repeat(81))).not.toBeNull();
  });
  it("rejects non-strings", () => {
    expect(validateName(null)).not.toBeNull();
    expect(validateName(123)).not.toBeNull();
  });
});

describe("validateEmail", () => {
  it("accepts valid emails", () => {
    expect(validateEmail("ali@example.com")).toBeNull();
    expect(validateEmail("user.name+tag@sub.domain.pk")).toBeNull();
  });
  it("rejects invalid emails", () => {
    expect(validateEmail("not-an-email")).not.toBeNull();
    expect(validateEmail("a@b")).not.toBeNull();
    expect(validateEmail("@example.com")).not.toBeNull();
    expect(validateEmail("")).not.toBeNull();
    expect(validateEmail(null)).not.toBeNull();
  });
});

describe("validatePassword", () => {
  it("accepts 8+ character passwords", () => {
    expect(validatePassword("secret123")).toBeNull();
  });
  it("rejects short passwords", () => {
    expect(validatePassword("short")).not.toBeNull();
    expect(validatePassword("")).not.toBeNull();
  });
});

describe("validateRegisterInput", () => {
  it("accepts a complete valid body", () => {
    expect(
      validateRegisterInput({
        name: "Ali Raza",
        email: "ali@example.com",
        password: "secret123",
      })
    ).toBeNull();
  });
  it("reports the first problem found", () => {
    expect(
      validateRegisterInput({ name: "A", email: "bad", password: "x" })
    ).not.toBeNull();
  });
  it("rejects non-object bodies", () => {
    expect(validateRegisterInput(null)).not.toBeNull();
    expect(validateRegisterInput("nope")).not.toBeNull();
    expect(validateRegisterInput({})).not.toBeNull();
  });
});

describe("validateLoginInput", () => {
  it("accepts valid credentials shape", () => {
    expect(
      validateLoginInput({ email: "ali@example.com", password: "anything" })
    ).toBeNull();
  });
  it("rejects bad email / missing password", () => {
    expect(validateLoginInput({ email: "bad", password: "x" })).not.toBeNull();
    expect(
      validateLoginInput({ email: "ali@example.com", password: "" })
    ).not.toBeNull();
    expect(validateLoginInput({ email: "ali@example.com" })).not.toBeNull();
  });
});
