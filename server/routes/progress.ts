/**
 * Progress API (mounted at /api/v1/progress, all endpoints require auth).
 *
 * GET /overview — aggregates the signed-in user's own interview rows into
 * totals, score averages, a 10-session trend, and per-language / per-category
 * breakdowns. Every number is computed from stored rows by
 * server/lib/progress.ts — nothing is fabricated; empty histories yield
 * nulls, which the UI renders as "—".
 */
import { Router } from "express";
import type { Request } from "express";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../drizzle/db.js";
import {
  answerEvaluations,
  interviewAnswers,
  interviewQuestions,
  interviewSessions,
} from "../../drizzle/schema.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { aggregateProgress } from "../lib/progress.js";

const router = Router();

function userIdOf(req: Request): number | null {
  return req.user?.id ?? null;
}

router.get(
  "/overview",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    if (userId === null) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const sessions = await db
      .select({
        id: interviewSessions.id,
        status: interviewSessions.status,
        interviewLanguage: interviewSessions.interviewLanguage,
        completedAt: interviewSessions.completedAt,
      })
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, userId));

    const sessionIds = sessions.map((s) => s.id);
    const questions =
      sessionIds.length > 0
        ? await db
            .select({
              id: interviewQuestions.id,
              sessionId: interviewQuestions.sessionId,
              category: interviewQuestions.category,
            })
            .from(interviewQuestions)
            .where(inArray(interviewQuestions.sessionId, sessionIds))
        : [];

    const answers =
      sessionIds.length > 0
        ? await db
            .select({
              id: interviewAnswers.id,
              sessionId: interviewAnswers.sessionId,
              questionId: interviewAnswers.questionId,
            })
            .from(interviewAnswers)
            .where(inArray(interviewAnswers.sessionId, sessionIds))
        : [];

    const answerById = new Map(answers.map((a) => [a.id, a] as const));
    const evals =
      answers.length > 0
        ? await db
            .select({
              answerId: answerEvaluations.answerId,
              scores: answerEvaluations.scores,
              overallScore: answerEvaluations.overallScore,
            })
            .from(answerEvaluations)
            .where(
              inArray(
                answerEvaluations.answerId,
                answers.map((a) => a.id)
              )
            )
        : [];

    const overview = aggregateProgress({
      sessions: sessions.map((s) => ({
        id: s.id,
        status: s.status,
        interviewLanguage: s.interviewLanguage,
        completedAt: s.completedAt,
      })),
      questions: questions.map((q) => ({
        id: q.id,
        sessionId: q.sessionId,
        category: q.category,
      })),
      evaluations: evals.flatMap((e) => {
        const answer = answerById.get(e.answerId);
        if (!answer) return [];
        return [
          {
            questionId: answer.questionId,
            sessionId: answer.sessionId,
            scores: e.scores,
            overallScore: e.overallScore,
          },
        ];
      }),
    });

    res.status(200).json({ overview });
  })
);

export default router;
