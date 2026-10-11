/**
 * AI provider wiring.
 *
 * v1 uses the local template provider (deterministic, honestly labeled —
 * see server/ai/templateProvider.ts). To plug in a real LLM later,
 * implement QuestionProvider + AnswerEvaluator from server/ai/types.ts and
 * swap these two exports. No call site changes needed.
 */
import type { AnswerEvaluator, QuestionProvider } from "./types.js";
import {
  TemplateAnswerEvaluator,
  TemplateQuestionProvider,
} from "./templateProvider.js";

export const questionProvider: QuestionProvider = new TemplateQuestionProvider();
export const answerEvaluator: AnswerEvaluator = new TemplateAnswerEvaluator();

export type { QuestionProvider, AnswerEvaluator } from "./types.js";
