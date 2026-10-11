/**
 * Unit tests for PATCH /api/v1/cvs/:id correction validation
 * (server/lib/cvValidation.ts). Pure validators — no DB.
 */
import { describe, expect, it } from "vitest";
import { validateCorrections } from "./cvValidation.js";

describe("validateCorrections", () => {
  it("accepts a full valid correction set", () => {
    const res = validateCorrections({
      name: "Ahmed Raza",
      email: "ahmed@example.com",
      phone: "0300-1234567",
      skills: ["JavaScript", "React"],
      education: ["BS Computer Science"],
      experienceYears: 2.5,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.name).toBe("Ahmed Raza");
      expect(res.value.experienceYears).toBe(2.5);
    }
  });

  it("accepts an empty object (no-op patch)", () => {
    expect(validateCorrections({}).ok).toBe(true);
  });

  it("accepts null to clear a field", () => {
    const res = validateCorrections({ phone: null });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.phone).toBeNull();
  });

  it("rejects unknown fields loudly", () => {
    const res = validateCorrections({ nickname: "x" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/unknown field/i);
  });

  it("rejects bad email, bad experience, oversized arrays", () => {
    expect(validateCorrections({ email: "not-an-email" }).ok).toBe(false);
    expect(validateCorrections({ experienceYears: 99 }).ok).toBe(false);
    expect(validateCorrections({ experienceYears: "many" }).ok).toBe(false);
    expect(
      validateCorrections({ skills: "JavaScript, React" }).ok
    ).toBe(false); // must be an array
    expect(validateCorrections({ name: "A" }).ok).toBe(false);
  });

  it("rejects non-object bodies", () => {
    expect(validateCorrections(null).ok).toBe(false);
    expect(validateCorrections("nope").ok).toBe(false);
  });
});
