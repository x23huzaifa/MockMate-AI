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
