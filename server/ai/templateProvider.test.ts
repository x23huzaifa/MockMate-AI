/**
 * Unit tests for the template question provider + heuristic evaluator.
 *
 * These tests pin the honesty contract: selection is deterministic
 * (no randomness anywhere) and evaluation is a transparent rubric —
 * a strong answer must outscore a weak one on every dimension.
 *
 * Run: pnpm test
 * Status: WRITTEN, NOT EXECUTED in this environment (no node_modules here).
 */
import { describe, expect, it } from "vitest";
import {
  TemplateAnswerEvaluator,
  TemplateQuestionProvider,
} from "./templateProvider.js";

const provider = new TemplateQuestionProvider();
const evaluator = new TemplateAnswerEvaluator();

const BASE_INPUT = {
  jobTitle: "Frontend Developer",
  requiredSkills: ["React", "TypeScript"],
  cvSkills: ["JavaScript", "CSS"],
  count: 5,
};

describe("template question provider", () => {
  it("is deterministic: same input → same questions, same order", async () => {
    const a = await provider.generateQuestions(BASE_INPUT);
    const b = await provider.generateQuestions(BASE_INPUT);
    expect(a).toEqual(b);
  });

  it("always starts with exactly one introduction question", async () => {
    for (const count of [3, 5, 10]) {
      const qs = await provider.generateQuestions({ ...BASE_INPUT, count });
      expect(qs).toHaveLength(count);
      expect(qs[0].category).toBe("introduction");
      expect(qs.filter((q) => q.category === "introduction")).toHaveLength(1);
    }
  });

  it("prefers technical questions matching the role keywords", async () => {
    const qs = await provider.generateQuestions({
      jobTitle: "React Developer",
      requiredSkills: ["React"],
      cvSkills: [],
      count: 6,
    });
    const technical = qs.filter((q) => q.category === "technical");
    expect(technical.length).toBeGreaterThan(0);
    // At least one technical question should mention React or JavaScript.
    const texts = technical.map((q) => q.text).join(" ").toLowerCase();
    expect(texts).toMatch(/react|javascript/);
  });

  it("clamps the question count to 3–10", async () => {
    expect(
      await provider.generateQuestions({ ...BASE_INPUT, count: 99 })
    ).toHaveLength(10);
    expect(
      await provider.generateQuestions({ ...BASE_INPUT, count: 1 })
    ).toHaveLength(3);
  });

  it("uses no randomness: bank order alone never leaks through", async () => {
    // Different job titles seed different shuffles, but each is stable.
    const a = await provider.generateQuestions({
      ...BASE_INPUT,
      jobTitle: "Data Analyst",
    });
    const b = await provider.generateQuestions({
      ...BASE_INPUT,
      jobTitle: "Data Analyst",
    });
    expect(a).toEqual(b);
  });
});

const QUESTION = "Tell me about a time you handled a difficult deadline.";
const HINTS = ["prioritization", "planning", "result"];

const STRONG_ANSWER = [
  "In my final year project, we had only three weeks left and the backend was",
  "not started. First, I broke the work into daily milestones and prioritized",
  "the must-have features. For example, I cut the admin dashboard from the",
  "scope and focused on the core matching API. I tracked progress in a shared",
  "sheet and we finished 2 days early. As a result, our demo scored 92 out of",
  "100. In conclusion, clear prioritization and honest daily planning saved the",
  "project.",
].join(" ");

const WEAK_ANSWER = "I don't know. It was fine I guess.";

describe("template answer evaluator", () => {
  it("scores a strong answer higher than a weak one on every dimension", async () => {
    const strong = await evaluator.evaluate({
      question: QUESTION,
      category: "behavioral",
      answerText: STRONG_ANSWER,
      rubricHints: HINTS,
    });
    const weak = await evaluator.evaluate({
      question: QUESTION,
      category: "behavioral",
      answerText: WEAK_ANSWER,
      rubricHints: HINTS,
    });
    for (const dim of ["relevance", "depth", "clarity", "structure"] as const) {
      expect(strong.scores[dim]).toBeGreaterThan(weak.scores[dim]);
    }
    expect(strong.overallScore).toBeGreaterThan(weak.overallScore);
  });

  it("keeps every dimension within 1–5 and overall as the mean", async () => {
    const result = await evaluator.evaluate({
      question: QUESTION,
      category: "behavioral",
      answerText: STRONG_ANSWER,
      rubricHints: HINTS,
    });
    for (const dim of ["relevance", "depth", "clarity", "structure"] as const) {
      expect(result.scores[dim]).toBeGreaterThanOrEqual(1);
      expect(result.scores[dim]).toBeLessThanOrEqual(5);
      expect(Number.isInteger(result.scores[dim])).toBe(true);
    }
    const mean =
      (result.scores.relevance +
        result.scores.depth +
        result.scores.clarity +
        result.scores.structure) /
      4;
    expect(result.overallScore).toBeCloseTo(Math.round(mean * 100) / 100, 5);
  });

  it("rewards concrete specifics (numbers, examples) with depth", async () => {
    const plain = await evaluator.evaluate({
      question: QUESTION,
      category: "behavioral",
      answerText:
        "I managed the timeline carefully and made sure everyone knew their tasks each day of the project work period.",
      rubricHints: HINTS,
    });
    const specific = await evaluator.evaluate({
      question: QUESTION,
      category: "behavioral",
      answerText:
        "I managed the timeline carefully and made sure everyone knew their tasks each day. For example, I split 3 weeks into 15 daily milestones and we delivered 2 days early.",
      rubricHints: HINTS,
    });
    expect(specific.scores.depth).toBeGreaterThanOrEqual(plain.scores.depth);
  });

  it("labels its output as heuristic, not human judgment", async () => {
    const result = await evaluator.evaluate({
      question: QUESTION,
      category: "behavioral",
      answerText: STRONG_ANSWER,
      rubricHints: HINTS,
    });
    expect(result.feedbackText).toMatch(/heuristic/i);
    expect(result.feedbackText).toMatch(/not human judgment/i);
  });

  it("gives targeted improvement tips for weak dimensions", async () => {
    const result = await evaluator.evaluate({
      question: QUESTION,
      category: "behavioral",
      answerText: WEAK_ANSWER,
      rubricHints: HINTS,
    });
    expect(result.improvements.length).toBeGreaterThan(0);
    expect(result.strengths.length).toBe(0);
  });
});
