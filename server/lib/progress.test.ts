/**
 * Unit tests for progress aggregation.
 *
 * Fixtures pin the honesty contract: averages over real rows, nulls (not
 * zeros) when there is nothing to average, and trend ordering oldest →
 * newest capped at the last 10 completed sessions.
 *
 * Run: pnpm test
 * Status: WRITTEN, NOT EXECUTED in this environment (no node_modules here).
 */
import { describe, expect, it } from "vitest";
import { aggregateProgress } from "./progress.js";
import type {
  ProgressEvaluationRow,
  ProgressQuestionRow,
  ProgressSessionRow,
} from "./progress.js";

function session(
  id: number,
  status: string,
  completedAt: string | null = null,
  interviewLanguage = "en"
): ProgressSessionRow {
  return { id, status, interviewLanguage, completedAt };
}

function question(
  id: number,
  sessionId: number,
  category: string
): ProgressQuestionRow {
  return { id, sessionId, category };
}

function evaluation(
  questionId: number,
  sessionId: number,
  overall: number,
  dim = 3
): ProgressEvaluationRow {
  return {
    questionId,
    sessionId,
    scores: { relevance: dim, depth: dim, clarity: dim, structure: dim },
    overallScore: overall,
  };
}

describe("aggregateProgress", () => {
  it("empty history → zero counts and all-null scores", () => {
    const out = aggregateProgress({ sessions: [], questions: [], evaluations: [] });
    expect(out.totalSessions).toBe(0);
    expect(out.completedSessions).toBe(0);
    expect(out.inProgressSessions).toBe(0);
    expect(out.avgOverallScore).toBeNull();
    expect(out.bestScore).toBeNull();
    expect(out.dimensionAverages).toEqual({
      relevance: null,
      depth: null,
      clarity: null,
      structure: null,
    });
    expect(out.scoreTrend).toEqual([]);
    expect(out.byLanguage).toEqual([]);
    expect(out.byCategory).toEqual([]);
  });

  it("counts terminal vs in-progress sessions correctly", () => {
    const out = aggregateProgress({
      sessions: [
        session(1, "completed", "2026-10-01T10:00:00Z"),
        session(2, "interrupted"),
        session(3, "failed"),
        session(4, "awaiting_answer"),
        session(5, "paused"),
      ],
      questions: [],
      evaluations: [],
    });
    expect(out.totalSessions).toBe(5);
    expect(out.completedSessions).toBe(1);
    // interrupted + failed are terminal; awaiting_answer + paused are not.
    expect(out.inProgressSessions).toBe(2);
  });

  it("averages overall scores per session, then across sessions", () => {
    const out = aggregateProgress({
      sessions: [
        session(1, "completed", "2026-10-01T10:00:00Z"),
        session(2, "completed", "2026-10-02T10:00:00Z"),
      ],
      questions: [
        question(11, 1, "technical"),
        question(12, 1, "behavioral"),
        question(21, 2, "technical"),
      ],
      evaluations: [
        evaluation(11, 1, 4),
        evaluation(12, 1, 2), // session 1 mean = 3
        evaluation(21, 2, 5), // session 2 mean = 5
      ],
    });
    expect(out.avgOverallScore).toBe(4); // (3 + 5) / 2
    expect(out.bestScore).toBe(5);
    expect(out.dimensionAverages.relevance).toBe(3);
  });

  it("scoreTrend: last 10 completed sessions, oldest → newest", () => {
    const sessions: ProgressSessionRow[] = [];
    const questions: ProgressQuestionRow[] = [];
    const evaluations: ProgressEvaluationRow[] = [];
    for (let i = 1; i <= 12; i++) {
      const day = String(i).padStart(2, "0");
      sessions.push(
        session(i, "completed", `2026-09-${day}T10:00:00Z`, i % 2 ? "en" : "ur")
      );
      questions.push(question(i * 10, i, "technical"));
      evaluations.push(evaluation(i * 10, i, (i % 5) + 1));
    }
    const out = aggregateProgress({ sessions, questions, evaluations });
    expect(out.scoreTrend).toHaveLength(10);
    // First two (oldest) dropped.
    expect(out.scoreTrend[0].sessionId).toBe(3);
    expect(out.scoreTrend[9].sessionId).toBe(12);
    // completedAt ordering preserved.
    const dates = out.scoreTrend.map((p) => p.completedAt);
    expect([...dates].sort()).toEqual(dates);
    // byLanguage counts all 12 sessions.
    expect(out.byLanguage).toEqual([
      { language: "en", count: 6 },
      { language: "ur", count: 6 },
    ]);
  });

  it("byCategory averages per-question-category scores", () => {
    const out = aggregateProgress({
      sessions: [session(1, "completed", "2026-10-01T10:00:00Z")],
      questions: [
        question(11, 1, "technical"),
        question(12, 1, "technical"),
        question(13, 1, "behavioral"),
      ],
      evaluations: [
        evaluation(11, 1, 4),
        evaluation(12, 1, 2),
        evaluation(13, 1, 5),
      ],
    });
    expect(out.byCategory).toEqual([
      { category: "behavioral", avgScore: 5 },
      { category: "technical", avgScore: 3 },
    ]);
  });

  it("ignores evaluations whose question is unknown to byCategory", () => {
    const out = aggregateProgress({
      sessions: [session(1, "completed", "2026-10-01T10:00:00Z")],
      questions: [],
      evaluations: [evaluation(999, 1, 4)],
    });
    expect(out.byCategory).toEqual([]);
    // …but the score still counts toward the session average.
    expect(out.avgOverallScore).toBe(4);
  });

  it("handles decimal-string overallScores from MySQL", () => {
    const out = aggregateProgress({
      sessions: [session(1, "completed", "2026-10-01T10:00:00Z")],
      questions: [question(11, 1, "technical")],
      evaluations: [
        { ...evaluation(11, 1, 4), overallScore: "3.50" },
      ],
    });
    expect(out.avgOverallScore).toBe(3.5);
  });
});
