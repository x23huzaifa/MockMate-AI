/**
 * Language registry for MockMate AI (Phase D — Pakistan-first).
 *
 * HONESTY CONTRACT (user-mandated): a language is only ever labeled at the
 * support level it has actually earned. Levels:
 * - "verified"     — corpus-tested end to end (see LANGUAGE_TEST_CASES.md)
 * - "partial"      — real templates/keywords exist, limited testing
 * - "experimental" — best-effort only (answers accepted verbatim, evaluated
 *                    with language-agnostic heuristics); may be wrong
 * - "unsupported"  — not offered anywhere
 *
 * Four SEPARATE settings (persisted per user AND per session):
 * 1. interviewLanguage  — the language questions are asked in
 * 2. responseLanguage   — what the candidate may answer in
 *                          (permissive: we store answers verbatim in any
 *                          language; this setting is a promise, not a lock)
 * 3. feedbackLanguage   — the language evaluations are written in
 * 4. evaluationLanguage — the language used for scoring rubric keywords
 *
 * Each setting has its own allowlist below, gated by what actually exists:
 * we do not offer a feedback language we have no templates for.
 */

export type SupportLevel =
  | "verified"
  | "partial"
  | "experimental"
  | "unsupported";

export interface LanguageInfo {
  code: string;
  /** Display label, e.g. "Urdu (اردو script)". */
  label: string;
  script: string;
  direction: "ltr" | "rtl";
  supportLevel: SupportLevel;
  /** One honest sentence about what works and what does not. */
  note: string;
}

export const SUPPORTED_LANGUAGE_CODES: LanguageInfo[] = [
  {
    code: "en",
    label: "English",
    script: "Latin",
    direction: "ltr",
    supportLevel: "verified",
    note:
      "Full template coverage: 40-question bank, keyword lists, feedback templates. Corpus-tested.",
  },
  {
    code: "ur",
    label: "Urdu (اردو)",
    script: "Arabic",
    direction: "rtl",
    supportLevel: "partial",
    note:
      "10 Urdu-script questions (introduction + behavioral), Urdu feedback templates, Urdu keyword list. Technical questions stay in English. Limited testing.",
  },
  {
    code: "roman-ur",
    label: "Roman Urdu",
    script: "Latin",
    direction: "ltr",
    supportLevel: "partial",
    note:
      "10 Roman-Urdu questions (introduction + behavioral), Roman-Urdu feedback templates, Roman-Urdu keyword list. Code-switched answers are not penalized. Limited testing.",
  },
  {
    code: "pa-roman",
    label: "Punjabi (Roman)",
    script: "Latin",
    direction: "ltr",
    supportLevel: "experimental",
    note:
      "No question bank or templates. Answers accepted verbatim and scored with language-agnostic heuristics only; keyword relevance may under-score.",
  },
  {
    code: "ps",
    label: "Pashto (پښتو)",
    script: "Arabic",
    direction: "rtl",
    supportLevel: "experimental",
    note:
      "No question bank or templates. Answers accepted verbatim and scored with language-agnostic heuristics only; keyword relevance may under-score.",
  },
  {
    code: "sd",
    label: "Sindhi (سنڌي)",
    script: "Arabic",
    direction: "rtl",
    supportLevel: "experimental",
    note:
      "No question bank or templates. Answers accepted verbatim and scored with language-agnostic heuristics only; keyword relevance may under-score.",
  },
  {
    code: "skb",
    label: "Saraiki (سرائیکی)",
    script: "Arabic",
    direction: "rtl",
    supportLevel: "experimental",
    note:
      "No question bank or templates. Answers accepted verbatim and scored with language-agnostic heuristics only; keyword relevance may under-score.",
  },
  {
    code: "bal",
    label: "Balochi (بلوچی)",
    script: "Latin/Arabic",
    direction: "ltr",
    supportLevel: "experimental",
    note:
      "No question bank or templates. Answers accepted verbatim and scored with language-agnostic heuristics only; keyword relevance may under-score.",
  },
];

export function languageInfo(code: string): LanguageInfo | null {
  return SUPPORTED_LANGUAGE_CODES.find((l) => l.code === code) ?? null;
}

export function isKnownLanguageCode(code: unknown): code is string {
  return typeof code === "string" && languageInfo(code) !== null;
}

/**
 * Per-setting allowlists — honest gating. A setting only accepts codes for
 * which that setting's capability actually exists.
 */
export const INTERVIEW_LANGUAGE_CODES = ["en", "ur", "roman-ur"] as const;
export const RESPONSE_LANGUAGE_CODES = [
  "en",
  "ur",
  "roman-ur",
  "pa-roman",
  "ps",
  "sd",
  "skb",
  "bal",
] as const;
export const FEEDBACK_LANGUAGE_CODES = ["en", "ur", "roman-ur"] as const;
export const EVALUATION_LANGUAGE_CODES = ["en", "ur", "roman-ur"] as const;

export type LanguageSettingKey =
  | "interviewLanguage"
  | "responseLanguage"
  | "feedbackLanguage"
  | "evaluationLanguage";

export const LANGUAGE_SETTING_KEYS: LanguageSettingKey[] = [
  "interviewLanguage",
  "responseLanguage",
  "feedbackLanguage",
  "evaluationLanguage",
];

const ALLOWLISTS: Record<LanguageSettingKey, readonly string[]> = {
  interviewLanguage: INTERVIEW_LANGUAGE_CODES,
  responseLanguage: RESPONSE_LANGUAGE_CODES,
  feedbackLanguage: FEEDBACK_LANGUAGE_CODES,
  evaluationLanguage: EVALUATION_LANGUAGE_CODES,
};

/** True when `code` is an allowed value for the given setting. */
export function isValidLanguageFor(
  setting: LanguageSettingKey,
  code: unknown
): code is string {
  return (
    typeof code === "string" &&
    (ALLOWLISTS[setting] as readonly string[]).includes(code)
  );
}

/** Human-readable error naming the allowed codes for a setting. */
export function languageSettingError(setting: LanguageSettingKey): string {
  return `${setting} must be one of: ${ALLOWLISTS[setting].join(", ")}.`;
}

/** Plain-language explanation of what each setting controls (UI copy). */
export const LANGUAGE_SETTING_EXPLANATIONS: Record<LanguageSettingKey, string> =
  {
    interviewLanguage:
      "The language interview questions are asked in. Only languages with a real question bank are offered.",
    responseLanguage:
      "The language (or mix) you plan to answer in. We never block or penalize any language — your answers are always stored exactly as you type them.",
    feedbackLanguage:
      "The language your per-answer feedback is written in. Only languages with real feedback templates are offered.",
    evaluationLanguage:
      "The language used for scoring keyword matching. Heuristics like answer length and structure work in every language.",
  };

export interface LanguageSettings {
  interviewLanguage: string;
  responseLanguage: string;
  feedbackLanguage: string;
  evaluationLanguage: string;
}

export const DEFAULT_LANGUAGE_SETTINGS: LanguageSettings = {
  interviewLanguage: "en",
  responseLanguage: "en",
  feedbackLanguage: "en",
  evaluationLanguage: "en",
};
