/**
 * CV text extraction + rules-based field parsing.
 *
 * Pure JS, no LLM, no native dependencies:
 * - PDF  → pdf-parse (pure JS)
 * - DOCX → mammoth  (pure JS)
 * - fields → hand-written heuristics in this file
 *
 * Honesty rule: when a field cannot be found, it stays null/empty and the
 * confidence label drops to "low". The parser NEVER invents skills,
 * degrees, or experience — an empty result is reported as empty.
 */
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import type { CvFields } from "../../drizzle/schema.js";
import type { CvFileType } from "./cvFiles.js";

export interface ParsedCvText {
  rawText: string;
  fields: CvFields;
  confidence: "low" | "medium";
}

/** Raw text out of the file. Empty string when nothing extractable. */
export async function extractCvText(
  buffer: Buffer,
  type: CvFileType
): Promise<string> {
  if (type === "pdf") {
    const data = (await pdfParse(buffer)) as { text?: unknown };
    return typeof data.text === "string" ? data.text : "";
  }
  const result = (await mammoth.extractRawText({ buffer })) as {
    value?: unknown;
  };
  return typeof result.value === "string" ? result.value : "";
}

// ---------------------------------------------------------------------------
// Field heuristics
// ---------------------------------------------------------------------------

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
// Pakistani mobile formats: 0300-1234567, +92 300 1234567, 03331234567 …
const PHONE_PK_RE = /(?:\+92|0092|0)?[\s-]*3\d{2}[\s-]*\d{7}/;
const PHONE_GENERIC_RE = /\+?\d[\d\s().-]{6,}\d/;
const EXP_RE = /(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?|saal)\b/gi;

const RESUME_WORDS_RE = /\b(curriculum vitae|resume|resum[ée]|bio-?data)\b/i;
const HEADER_WORDS_RE =
  /\b(e-?mail|phone|mobile|address|objective|summary|profile|contact|experience|education|skills|career)\b/i;

/**
 * ~80 common skills matched case-insensitively against the CV text.
 * Deliberately excludes single-letter / ambiguous tokens ("c", "go", "r")
 * that would produce false positives.
 */
const SKILL_LIST: string[] = [
  // programming languages & data
  "javascript",
  "typescript",
  "python",
  "java",
  "c++",
  "c#",
  "php",
  "ruby",
  "rust",
  "kotlin",
  "swift",
  "dart",
  "sql",
  "mysql",
  "postgresql",
  "mongodb",
  "redis",
  // web & mobile
  "html",
  "css",
  "react",
  "angular",
  "vue",
  "next.js",
  "node.js",
  "express",
  "django",
  "flask",
  "laravel",
  "spring boot",
  "asp.net",
  "flutter",
  "react native",
  "graphql",
  "rest api",
  "firebase",
  // ai / data
  "tensorflow",
  "pytorch",
  "scikit-learn",
  "pandas",
  "numpy",
  "machine learning",
  "deep learning",
  "data analysis",
  "data visualization",
  "statistical analysis",
  // devops & tools
  "docker",
  "kubernetes",
  "aws",
  "azure",
  "devops",
  "ci/cd",
  "git",
  "github",
  "linux",
  "nginx",
  "postman",
  "jira",
  // design & office
  "figma",
  "ui design",
  "ux design",
  "photoshop",
  "illustrator",
  "wordpress",
  "seo",
  "microsoft office",
  "excel",
  "power bi",
  // soft skills
  "communication",
  "teamwork",
  "leadership",
  "problem solving",
  "time management",
  "adaptability",
  "critical thinking",
  "creativity",
  "collaboration",
  "work ethic",
  "attention to detail",
  "project management",
  "agile",
  "scrum",
  "mentoring",
  "documentation",
  "content writing",
  "digital marketing",
  "customer service",
  "quick learner",
  "self-motivated",
];

const DEGREE_RES: RegExp[] = [
  /\bph\.?\s?d\.?\b/i,
  /\bm\.?\s?phil\.?\b/i,
  /\bmaster'?s\b/i,
  /\bmba\b/i,
  /\bbachelor'?s\b/i,
  /\bbs\b/i,
  /\bbcs\b/i,
  /\bbe\b/i,
  /\bbba\b/i,
  /\bbsc?\b/i,
  /\bintermediate\b/i,
  /\bhssc\b/i,
  /\bfsc\b/i,
  /\bfa\b/i,
  /\bics\b/i,
  /\ba[-\s]?levels?\b/i,
  /\bmatric/i,
  /\bssc\b/i,
  /\bo[-\s]?levels?\b/i,
  /\bdiploma\b/i,
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Skill regex: alnum boundaries so "java" never matches inside "javascript". */
function skillPattern(skill: string): RegExp {
  const e = escapeRegExp(skill.toLowerCase());
  const left = /^[a-z0-9]/.test(skill) ? "(?<![a-z0-9])" : "";
  const right = /[a-z0-9]$/.test(skill) ? "(?![a-z0-9])" : "";
  return new RegExp(`${left}${e}${right}`);
}

/** First plausible name line: 2–5 words, letters only, no digits/@, not a heading. */
function extractName(lines: string[]): string | null {
  for (const line of lines.slice(0, 4)) {
    const words = line.split(/\s+/).filter(Boolean);
    if (line.length === 0 || line.length > 60) continue;
    if (/\d/.test(line)) continue;
    if (line.includes("@")) continue;
    if (RESUME_WORDS_RE.test(line)) continue;
    if (HEADER_WORDS_RE.test(line)) continue;
    if (words.length < 2 || words.length > 5) continue;
    if (!/^[A-Za-z][A-Za-z .'-]*$/.test(line)) continue;
    return line;
  }
  return null;
}

function extractPhone(text: string): string | null {
  const pk = text.match(PHONE_PK_RE);
  if (pk) return pk[0].trim();
  const generic = text.match(PHONE_GENERIC_RE);
  return generic ? generic[0].trim() : null;
}

function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const skill of SKILL_LIST) {
    if (skillPattern(skill).test(lower)) found.push(skill);
  }
  return found;
}

/** Capture the CV line containing each degree keyword (deduped, trimmed). */
function extractEducation(lines: string[]): string[] {
  const entries: string[] = [];
  for (const line of lines) {
    if (line.length > 160) continue;
    if (!DEGREE_RES.some((re) => re.test(line))) continue;
    const cleaned = line.replace(/\s+/g, " ").trim().slice(0, 140);
    if (cleaned && !entries.includes(cleaned)) entries.push(cleaned);
  }
  return entries;
}

/** Largest "N years" figure in the text, or null when none. */
function extractExperienceYears(text: string): number | null {
  let max: number | null = null;
  for (const match of text.matchAll(EXP_RE)) {
    const n = Number(match[1]);
    if (Number.isFinite(n) && n <= 60 && (max === null || n > max)) {
      max = n;
    }
  }
  return max;
}

/**
 * Parse fields from raw CV text. Confidence is "medium" when at least three
 * independent field groups were found, otherwise "low" — the UI shows low
 * confidence results with a "review carefully" hint.
 */
export function parseCvText(rawText: string): ParsedCvText {
  const text = typeof rawText === "string" ? rawText : "";
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const emailMatch = text.match(EMAIL_RE);
  const fields: CvFields = {
    name: extractName(lines),
    email: emailMatch ? emailMatch[0].trim() : null,
    phone: extractPhone(text),
    skills: extractSkills(text),
    education: extractEducation(lines),
    experienceYears: extractExperienceYears(text),
  };

  let score = 0;
  if (fields.name) score++;
  if (fields.email) score++;
  if (fields.phone) score++;
  if (fields.experienceYears !== null) score++;
  if (fields.skills.length > 0) score++;
  if (fields.education.length > 0) score++;

  return {
    rawText: text.slice(0, 100_000),
    fields,
    confidence: score >= 3 ? "medium" : "low",
  };
}
