/**
 * Progress aggregation — pure functions over rows fetched from the DB.
 *
 * Every number in ProgressOverview is computed from stored interview rows;
 * nothing is fabricated. Missing data is represented as null (the UI renders
 * "—", never 0), and empty histories produce an all-null overview.
 *
 * No DB access here — the route fetches rows, this module aggregates.
 * Unit-testable with fixtures (server/lib/progress.test.ts).
 */

export interface ProgressSessionRow {
  id: number;
  status: string;
  interviewLanguage: string;
  completedAt: string | Date | null;
}

export interface ProgressQuestionRow {
  id: number;
  sessionId: number;
  category: string;
}

export interface ProgressEvaluationRow {
  questionId: number;
  sessionId: number;
  scores: { relevance: number; depth: number; clarity: number; structure: number };
  overallScore: string | number | null;
}

export interface ProgressOverview {
  totalSessions: number;
  completedSessions: number;
  inProgressSessions: number;
  avgOverallScore: number | null;
  bestScore: number | null;
  dimensionAverages: {
    relevance: number | null;
    depth: number | null;
    clarity: number | null;
    structure: number | null;
  };
  scoreTrend: Array<{
    sessionId: number;
    completedAt: string | null;
    overallScore: number;
  }>;
  byLanguage: Array<{ language: string; count: number }>;
  byCategory: Array<{ category: string; avgScore: number }>;
}

/** Terminal interview statuses — everything else counts as in progress. */
const TERMINAL_STATUSES = new Set(["completed", "interrupted", "failed"]);

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;
}

function toScore(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function toIso(value: string | Date | null): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

export function aggregateProgress(input: {
  sessions: ProgressSessionRow[];
  questions: ProgressQuestionRow[];
  evaluations: ProgressEvaluationRow[];
}): ProgressOverview {
  const { sessions, questions, evaluations } = input;

  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(
    (s) => s.status === "completed"
  ).length;
  const inProgressSessions = sessions.filter(
    (s) => !TERMINAL_STATUSES.has(s.status)
  ).length;

  // Overall score of one session = mean of its evaluated answers' scores.
  const evalsBySession = new Map<number, ProgressEvaluationRow[]>();
  for (const e of evaluations) {
    const arr = evalsBySession.get(e.sessionId) ?? [];
    arr.push(e);
    evalsBySession.set(e.sessionId, arr);
  }
  const sessionScores = new Map<number, number>();
  for (const [sessionId, evals] of evalsBySession) {
    const scores = evals
      .map((e) => toScore(e.overallScore))
      .filter((n): n is number => n !== null);
    const m = mean(scores);
    if (m !== null) sessionScores.set(sessionId, m);
  }

  const allScores = [...sessionScores.values()];
  const avgOverallScore = mean(allScores);
  const bestScore = allScores.length > 0 ? Math.max(...allScores) : null;

  const dim = (key: "relevance" | "depth" | "clarity" | "structure") =>
    mean(
      evaluations
        .map((e) => e.scores[key])
        .filter((n) => typeof n === "number" && Number.isFinite(n))
    );
  const dimensionAverages = {
    relevance: dim("relevance"),
    depth: dim("depth"),
    clarity: dim("clarity"),
    structure: dim("structure"),
  };

  // Trend: last 10 completed sessions with a score, oldest → newest.
  const trend = sessions
    .filter((s) => s.status === "completed" && sessionScores.has(s.id))
    .map((s) => ({
      sessionId: s.id,
      completedAt: toIso(s.completedAt),
      overallScore: sessionScores.get(s.id)!,
      sortKey: toIso(s.completedAt) ?? "",
    }))
    .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))
    .slice(-10)
    .map(({ sessionId, completedAt, overallScore }) => ({
      sessionId,
      completedAt,
      overallScore,
    }));

  const langCounts = new Map<string, number>();
  for (const s of sessions) {
    langCounts.set(s.interviewLanguage, (langCounts.get(s.interviewLanguage) ?? 0) + 1);
  }
  const byLanguage = [...langCounts.entries()]
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count);

  const categoryByQuestion = new Map<number, string>();
  for (const q of questions) categoryByQuestion.set(q.id, q.category);
  const scoresByCategory = new Map<string, number[]>();
  for (const e of evaluations) {
    const category = categoryByQuestion.get(e.questionId);
    const score = toScore(e.overallScore);
    if (!category || score === null) continue;
    const arr = scoresByCategory.get(category) ?? [];
    arr.push(score);
    scoresByCategory.set(category, arr);
  }
  const byCategory = [...scoresByCategory.entries()]
    .map(([category, scores]) => ({ category, avgScore: mean(scores)! }))
    .sort((a, b) => b.avgScore - a.avgScore);

  return {
    totalSessions,
    completedSessions,
    inProgressSessions,
    avgOverallScore,
    bestScore,
    dimensionAverages,
    scoreTrend: trend,
    byLanguage,
    byCategory,
  };
}
