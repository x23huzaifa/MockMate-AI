/**
 * Phase D multilingual tests (server/ai/multilingual.test.ts).
 *
 * Pins the honesty contract for Pakistan-first language support:
 * - localized question banks are selected by interviewLanguage and have
 *   exactly the documented counts (no inflation);
 * - feedback is written in the session's feedbackLanguage, falling back to
 *   English (logged, never silent) when templates do not exist;
 * - code-switched and non-English answers are NOT penalized for language.
 *
 * Run: pnpm test
 * Status: WRITTEN, NOT EXECUTED in this environment (no node_modules here).
 */
import { describe, expect, it } from "vitest";
import {
  ROMAN_URDU_QUESTION_BANK,
  TemplateAnswerEvaluator,
  TemplateQuestionProvider,
  URDU_QUESTION_BANK,
} from "./templateProvider.js";
import { FEEDBACK_TEMPLATE_LANGUAGES } from "./feedbackTemplates.js";

const provider = new TemplateQuestionProvider();
const evaluator = new TemplateAnswerEvaluator();

const BASE_INPUT = {
  jobTitle: "Frontend Developer",
  requiredSkills: ["React"],
  cvSkills: [],
  count: 5,
};

const URDU_SCRIPT = /[\u0600-\u06FF]/;

describe("localized question banks (honest counts)", () => {
  it("Urdu bank has exactly 10 questions: 5 introduction + 5 behavioral", () => {
    expect(URDU_QUESTION_BANK).toHaveLength(10);
    expect(
      URDU_QUESTION_BANK.filter((q) => q.category === "introduction")
    ).toHaveLength(5);
    expect(
      URDU_QUESTION_BANK.filter((q) => q.category === "behavioral")
    ).toHaveLength(5);
    for (const q of URDU_QUESTION_BANK) {
      expect(URDU_SCRIPT.test(q.text)).toBe(true);
    }
  });

  it("Roman-Urdu bank has exactly 10 questions: 5 introduction + 5 behavioral", () => {
    expect(ROMAN_URDU_QUESTION_BANK).toHaveLength(10);
    expect(
      ROMAN_URDU_QUESTION_BANK.filter((q) => q.category === "introduction")
    ).toHaveLength(5);
    expect(
      ROMAN_URDU_QUESTION_BANK.filter((q) => q.category === "behavioral")
    ).toHaveLength(5);
    for (const q of ROMAN_URDU_QUESTION_BANK) {
      expect(URDU_SCRIPT.test(q.text)).toBe(false);
    }
  });
});

describe("interviewLanguage selects the question bank", () => {
  it("ur → first question is Urdu-script", async () => {
    const qs = await provider.generateQuestions({
      ...BASE_INPUT,
      interviewLanguage: "ur",
    });
    expect(qs).toHaveLength(5);
    expect(URDU_SCRIPT.test(qs[0].text)).toBe(true);
  });

  it("roman-ur → first question is Roman Urdu, not Urdu script", async () => {
    const qs = await provider.generateQuestions({
      ...BASE_INPUT,
      interviewLanguage: "roman-ur",
    });
    expect(qs).toHaveLength(5);
    expect(URDU_SCRIPT.test(qs[0].text)).toBe(false);
    expect(/batayein|aap/i.test(qs[0].text)).toBe(true);
  });

  it("unknown/omitted interviewLanguage → English bank", async () => {
    const omitted = await provider.generateQuestions({ ...BASE_INPUT });
    const unknown = await provider.generateQuestions({
      ...BASE_INPUT,
      interviewLanguage: "ps",
    });
    for (const qs of [omitted, unknown]) {
      expect(qs[0].category).toBe("introduction");
      expect(URDU_SCRIPT.test(qs[0].text)).toBe(false);
    }
    // Unknown codes fall back to exactly the English selection.
    expect(unknown).toEqual(omitted);
  });

  it("is deterministic per language; ur and en differ", async () => {
    const a = await provider.generateQuestions({
      ...BASE_INPUT,
      interviewLanguage: "ur",
    });
    const b = await provider.generateQuestions({
      ...BASE_INPUT,
      interviewLanguage: "ur",
    });
    expect(a).toEqual(b);
    const en = await provider.generateQuestions({
      ...BASE_INPUT,
      interviewLanguage: "en",
    });
    expect(a[0].text).not.toBe(en[0].text);
  });
});

describe("feedback language selection + fallback", () => {
  it("templates exist only for en, ur, roman-ur", () => {
    expect(FEEDBACK_TEMPLATE_LANGUAGES).toEqual(["en", "ur", "roman-ur"]);
  });

  it("feedbackLanguage 'ur' → feedback written in Urdu script", async () => {
    const result = await evaluator.evaluate({
      question: "Tell me about yourself.",
      category: "introduction",
      answerText: "ok",
      rubricHints: ["relevant experience"],
      feedbackLanguage: "ur",
      evaluationLanguage: "ur",
    });
    expect(result.feedbackText).toBeTruthy();
    expect(URDU_SCRIPT.test(result.feedbackText!)).toBe(true);
    expect(result.feedbackText).not.toContain("Overall");
    expect(result.strengths.concat(result.improvements).length).toBeGreaterThan(0);
  });

  it("feedbackLanguage 'roman-ur' → feedback in Roman Urdu", async () => {
    const result = await evaluator.evaluate({
      question: "Tell me about yourself.",
      category: "introduction",
      answerText: "ok",
      rubricHints: ["relevant experience"],
      feedbackLanguage: "roman-ur",
      evaluationLanguage: "roman-ur",
    });
    expect(/score 5 mein se/i.test(result.feedbackText!)).toBe(true);
    expect(URDU_SCRIPT.test(result.feedbackText!)).toBe(false);
  });

  it("unsupported feedback language falls back to English (never silent garbage)", async () => {
    const result = await evaluator.evaluate({
      question: "Tell me about yourself.",
      category: "introduction",
      answerText: "ok",
      rubricHints: ["relevant experience"],
      feedbackLanguage: "ps",
      evaluationLanguage: "en",
    });
    expect(result.feedbackText).toContain("Overall");
    expect(URDU_SCRIPT.test(result.feedbackText!)).toBe(false);
  });
});

describe("no language penalty", () => {
  const question = "Tell me about a time you led a team under a tight deadline.";
  const hints = ["leadership", "team", "deadline", "planning", "result"];

  it("code-switched (Roman Urdu + English) answer scores relevance ≥ pure-English equivalent", async () => {
    const english =
      "I led the team and completed the project before the deadline. I planned the work carefully and we delivered a good result on time.";
    const mixed =
      "Main ne team ko lead kiya aur project deadline se pehle complete kiya. Planning achi thi aur result time par deliver hua.";
    const eng = await evaluator.evaluate({
      question,
      category: "behavioral",
      answerText: english,
      rubricHints: hints,
      feedbackLanguage: "en",
      evaluationLanguage: "roman-ur",
    });
    const mix = await evaluator.evaluate({
      question,
      category: "behavioral",
      answerText: mixed,
      rubricHints: hints,
      feedbackLanguage: "en",
      evaluationLanguage: "roman-ur",
    });
    expect(mix.scores.relevance).toBeGreaterThanOrEqual(eng.scores.relevance);
    expect(mix.scores.relevance).toBeGreaterThanOrEqual(3);
  });

  it("Urdu-script answer to an Urdu question earns keyword relevance (not stuck at 1)", async () => {
    const q = URDU_QUESTION_BANK[0];
    const result = await evaluator.evaluate({
      question: q.text,
      category: q.category,
      answerText:
        "میرے پاس متعلقہ تجربہ ہے۔ میں نے کیریئر میں کئی منصوبے مکمل کیے۔",
      rubricHints: q.rubricHints,
      feedbackLanguage: "ur",
      evaluationLanguage: "ur",
    });
    expect(result.scores.relevance).toBeGreaterThanOrEqual(2);
  });

  it("length/structure heuristics still work on non-Latin answers", async () => {
    const longUrdu =
      "میرے پاس متعلقہ تجربہ ہے اور میں نے کیریئر میں کئی منصوبے مکمل کیے ہیں۔ " +
      "میں ٹیم کی قیادت کرتا ہوں اور ہر منصوبے کی منصوبہ بندی کرتا ہوں۔ " +
      "مشکل وقت میں میں پرسکون رہتا ہوں اور ٹیم کی مدد کرتا ہوں۔ " +
      "میرا نتیجہ ہمیشہ وقت پر ہوتا ہے۔";
    const result = await evaluator.evaluate({
      question: URDU_QUESTION_BANK[0].text,
      category: "behavioral",
      answerText: longUrdu,
      rubricHints: URDU_QUESTION_BANK[0].rubricHints,
      feedbackLanguage: "ur",
      evaluationLanguage: "ur",
    });
    // 4 Urdu sentences, ~40 words → depth and clarity must reflect that.
    expect(result.scores.depth).toBeGreaterThanOrEqual(3);
    expect(result.scores.clarity).toBeGreaterThanOrEqual(3);
  });
});
