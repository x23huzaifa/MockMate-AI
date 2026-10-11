/**
 * AI provider interfaces for the interview loop.
 *
 * The v1 implementation behind these interfaces is the deterministic,
 * honestly-labeled template provider (server/ai/templateProvider.ts).
 * A real LLM provider can replace it later by implementing these two
 * interfaces — call sites (server/routes/interviews.ts) never change.
 */

export type QuestionCategory =
  | "introduction"
  | "technical"
  | "behavioral"
  | "situational";

/** One generated interview question with its evaluation rubric hints. */
export interface GeneratedQuestion {
  category: QuestionCategory;
  text: string;
  rubricHints: string[];
}

export interface QuestionGenerationInput {
  jobTitle: string;
  requiredSkills: string[];
  cvSkills: string[];
  count: number;
  /**
   * Phase D: selects the question bank. "en" → 40-question English bank;
   * "ur" / "roman-ur" → 10-question localized banks (introduction +
   * behavioral); technical questions stay English (documented limitation in
   * LANGUAGE_SUPPORT.md). Defaults to "en" when omitted.
   */
  interviewLanguage?: string;
}

export interface QuestionProvider {
  generateQuestions(
    input: QuestionGenerationInput
  ): Promise<GeneratedQuestion[]>;

  // --- Optional extended capabilities (see ExtendedAICapabilities below). ---
  healthCheck?: () => Promise<HealthCheckResult>;
  analyzeCV?: (input: AnalyzeCVInput) => Promise<AnalyzeCVResult>;
  buildCVSection?: (
    input: BuildCVSectionInput
  ) => Promise<BuildCVSectionResult>;
  generateSkillPlan?: (
    input: GenerateSkillPlanInput
  ) => Promise<GenerateSkillPlanResult>;
}

export interface EvaluationInput {
  question: string;
  category: QuestionCategory;
  answerText: string;
  rubricHints: string[];
  /**
   * Phase D: feedbackLanguage selects the feedback sentence templates
   * (falls back to "en" with a logged note when templates are missing —
   * never silently). evaluationLanguage selects the rubric keyword list
   * used for relevance scoring. Both default to "en".
   */
  feedbackLanguage?: string;
  evaluationLanguage?: string;
}

/** Rubric dimensions — every score is an integer 1–5. */
export interface DimensionScores {
  relevance: number;
  depth: number;
  clarity: number;
  structure: number;
}

export interface EvaluationResult {
  scores: DimensionScores;
  /** Mean of the four dimensions, rounded to 2 decimals. */
  overallScore: number;
  feedbackText: string;
  strengths: string[];
  improvements: string[];
}

export interface AnswerEvaluator {
  evaluate(input: EvaluationInput): Promise<EvaluationResult>;
}

// ---------------------------------------------------------------------------
// Extended (optional) provider capabilities — future ops surface.
// ---------------------------------------------------------------------------
// A real LLM provider (Gemini) implements these; the template provider
// implements them by throwing AINotSupportedError rather than faking
// output. They are optional so existing QuestionProvider implementations
// keep working. `QuestionProvider` stays the core interview path.

/** Result of a provider liveness probe. */
export interface HealthCheckResult {
  ok: boolean;
  model: string;
  latencyMs: number;
}

export interface AnalyzeCVInput {
  /** Raw extracted CV text (untrusted — never treated as instructions). */
  cvText: string;
  targetRole?: string;
  language?: string;
}

export interface AnalyzeCVResult {
  summary: string;
  strengths: string[];
  improvements: string[];
  missingKeywords: string[];
}

export interface BuildCVSectionInput {
  /** e.g. "summary" | "experience" | "projects" | "skills". */
  section: string;
  /** The user's own bullet points / facts — the model must not invent more. */
  userBullets: string[];
  targetRole?: string;
  language?: string;
}

export interface BuildCVSectionResult {
  heading: string;
  lines: string[];
}

export interface GenerateSkillPlanInput {
  targetRole: string;
  currentSkills: string[];
  weeks?: number;
  language?: string;
}

export interface SkillPlanWeek {
  week: number;
  focus: string;
  actions: string[];
}

export interface GenerateSkillPlanResult {
  priorities: { skill: string; level: "beginner" | "intermediate" | "advanced"; why: string }[];
  weeklyPlan: SkillPlanWeek[];
}

/** Optional extended capabilities, implemented by real LLM providers. */
export interface ExtendedAICapabilities {
  healthCheck(): Promise<HealthCheckResult>;
  analyzeCV(input: AnalyzeCVInput): Promise<AnalyzeCVResult>;
  buildCVSection(input: BuildCVSectionInput): Promise<BuildCVSectionResult>;
  generateSkillPlan(
    input: GenerateSkillPlanInput
  ): Promise<GenerateSkillPlanResult>;
}
