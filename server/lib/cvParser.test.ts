/**
 * Unit tests for the rules-based CV parser (server/lib/cvParser.ts).
 *
 * No DB, no network, no fixtures on disk — sample CV texts are inline.
 * The honesty rule under test: unknown fields stay null/empty and
 * confidence drops to "low"; the parser must never invent data.
 */
import { describe, expect, it } from "vitest";
import { parseCvText } from "./cvParser.js";

const ENGLISH_CV = `Muhammad Ahmed Khan
ahmed.khan@example.com | 0300-1234567 | Lahore, Pakistan

SUMMARY
Software engineer with 3 years of experience building web applications.

SKILLS
JavaScript, TypeScript, React, Node.js, Express, MongoDB, Git, Docker, Agile, Communication

EXPERIENCE
Software Engineer — TechSolutions Lahore (2022 - Present)
- Built REST APIs with Node.js and Express serving 10k daily users.

EDUCATION
Bachelor's in Computer Science — Virtual University of Pakistan (2018 - 2022)
`;

const ROMAN_URDU_CV = `Ahmed Raza
ahmed.raza@example.com
0333-9876543

Mera naam Ahmed Raza hai. Mujhe software development mein 2 saal ka tajurba hai.
Main ne JavaScript aur React par kaam kiya hai.

Taleem: Intermediate (FSC) — BISE Lahore
Hunar: communication, teamwork, time management
`;

const PROSE_NOT_A_CV = `The quick brown fox jumps over the lazy dog.
Pack my box with five dozen liquor jugs.`;

describe("parseCvText", () => {
  it("extracts fields from an English CV", () => {
    const { fields, confidence } = parseCvText(ENGLISH_CV);
    expect(fields.name).toBe("Muhammad Ahmed Khan");
    expect(fields.email).toBe("ahmed.khan@example.com");
    expect(fields.phone).toContain("0300");
    expect(fields.experienceYears).toBe(3);
    expect(fields.skills).toEqual(
      expect.arrayContaining([
        "javascript",
        "typescript",
        "react",
        "node.js",
        "express",
        "mongodb",
        "git",
        "docker",
        "agile",
        "communication",
      ])
    );
    expect(fields.education.length).toBeGreaterThan(0);
    expect(fields.education[0]).toMatch(/bachelor/i);
    expect(confidence).toBe("medium");
  });

  it("handles a Roman Urdu mixed CV (saal = years)", () => {
    const { fields, confidence } = parseCvText(ROMAN_URDU_CV);
    expect(fields.name).toBe("Ahmed Raza");
    expect(fields.email).toBe("ahmed.raza@example.com");
    expect(fields.phone).toContain("0333");
    expect(fields.experienceYears).toBe(2);
    expect(fields.skills).toEqual(
      expect.arrayContaining([
        "javascript",
        "react",
        "communication",
        "teamwork",
        "time management",
      ])
    );
    expect(fields.education.length).toBeGreaterThan(0);
    expect(fields.education[0]).toMatch(/intermediate/i);
    expect(confidence).toBe("medium");
  });

  it("marks low confidence and invents nothing for prose that is not a CV", () => {
    const { fields, confidence } = parseCvText(PROSE_NOT_A_CV);
    expect(confidence).toBe("low");
    expect(fields.name).toBeNull();
    expect(fields.email).toBeNull();
    expect(fields.phone).toBeNull();
    expect(fields.skills).toEqual([]);
    expect(fields.education).toEqual([]);
    expect(fields.experienceYears).toBeNull();
  });

  it("marks low confidence and returns empty fields for blank text", () => {
    const { fields, confidence, rawText } = parseCvText("   \n\n  ");
    expect(confidence).toBe("low");
    expect(fields.name).toBeNull();
    expect(fields.skills).toEqual([]);
    expect(rawText).toBe("   \n\n  ");
  });

  it("does not match 'java' inside 'javascript' (word boundaries)", () => {
    const { fields } = parseCvText("Skills: JavaScript");
    expect(fields.skills).toContain("javascript");
    expect(fields.skills).not.toContain("java");
  });

  it("picks the largest experience figure", () => {
    const { fields } = parseCvText(
      "2 years of internship and 5+ years of professional work"
    );
    expect(fields.experienceYears).toBe(5);
  });

  it("takes the first email when several are present", () => {
    const { fields } = parseCvText(
      "Contact: first@example.com or second@example.com"
    );
    expect(fields.email).toBe("first@example.com");
  });
});
