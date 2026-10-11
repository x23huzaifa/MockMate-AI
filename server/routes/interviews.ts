/**
 * Interview API (mounted at /api/v1/interviews, all endpoints require auth).
 *
 * - POST /            create a session (status `created`) + generate questions
 * - GET /             list my sessions (?status= filter)
 * - GET /:id          full detail: session + questions + answers + evaluations
 * - POST /:id/start   created → asking → awaiting_answer (returns Q1)
 * - POST /:id/answer  submit answer (awaiting_answer only) → evaluate →
 *                     awaiting_answer (next Q) or completed (last Q)
 * - POST /:id/pause   → paused        POST /:id/resume → awaiting_answer
 * - POST /:id/interrupt → interrupted (terminal)
 * - GET /:id/report   aggregated report — every number computed from rows
 *
 * Every :id endpoint returns 404 "Interview not found." for both missing
 * rows and other users' rows (no IDOR leak). Illegal state moves return
 * 409 via the state machine (server/lib/interviewState.ts).
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../drizzle/db.js";
import {
  answerEvaluations,
  cvs,
  interviewAnswers,
  interviewQuestions,
  interviewSessions,
  jobProfiles,
} from "../../drizzle/schema.js";
import type {
  AnswerEvaluation,
  Cv,
  InterviewAnswer,
  InterviewQuestion,
  InterviewSession,
  JobProfile,
} from "../../drizzle/schema.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { ownsCv } from "../lib/cvFiles.js";
import { ownsJobProfile, ownsSession } from "../lib/interviewGuards.js";
import {
  assertTransition,
  isInterviewStatus,
  StateError,
} from "../lib/interviewState.js";
import type { InterviewStatus } from "../lib/interviewState.js";
import {
  validateAnswerInput,
  validateInterviewCreateInput,
} from "../lib/interviewValidation.js";
import { answerEvaluator, questionProvider } from "../ai/index.js";
import type { QuestionCategory } from "../ai/types.js";

const router = Router();

function userIdOf(req: Request): number | null {
  return req.user?.id ?? null;
}

function parseIdParam(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(s);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function findSession(id: number): Promise<InterviewSession | null> {
  const rows = await db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.id, id))
    .limit(1);
  return rows[0] ?? null;
}

async function findJobProfile(id: number): Promise<JobProfile | null> {
  const rows = await db
    .select()
    .from(jobProfiles)
    .where(eq(jobProfiles.id, id))
    .limit(1);
  return rows[0] ?? null;
}

async function findCv(id: number): Promise<Cv | null> {
  const rows = await db.select().from(cvs).where(eq(cvs.id, id)).limit(1);
  return rows[0] ?? null;
}

async function getQuestions(sessionId: number): Promise<InterviewQuestion[]> {
  return db
    .select()
    .from(interviewQuestions)
    .where(eq(interviewQuestions.sessionId, sessionId))
    .orderBy(asc(interviewQuestions.orderIndex));
}

function statusOf(row: InterviewSession): InterviewStatus | null {
  return isInterviewStatus(row.status) ? row.status : null;
}

function toPublicSession(row: InterviewSession) {
  return {
    id: row.id,
    jobProfileId: row.jobProfileId,
    cvId: row.cvId,
    interviewLanguage: row.interviewLanguage,
    responseLanguage: row.responseLanguage,
    feedbackLanguage: row.feedbackLanguage,
    evaluationLanguage: row.evaluationLanguage,
    status: row.status,
    currentQuestionIndex: row.currentQuestionIndex,
    totalQuestions: row.totalQuestions,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toPublicQuestion(row: InterviewQuestion) {
  return {
    id: row.id,
    orderIndex: row.orderIndex,
    category: row.category,
    questionText: row.questionText,
    rubricHints: row.rubricHints ?? [],
  };
}

function toPublicAnswer(row: InterviewAnswer) {
  return {
    id: row.id,
    questionId: row.questionId,
    answerText: row.answerText,
    answeredAt: row.answeredAt,
  };
}

function toPublicEvaluation(row: AnswerEvaluation) {
  return {
    id: row.id,
    answerId: row.answerId,
    scores: row.scores,
    overallScore: row.overallScore,
    feedbackText: row.feedbackText,
    strengths: row.strengths ?? [],
    improvements: row.improvements ?? [],
    evaluatedAt: row.evaluatedAt,
  };
}

/** Persist a status change after the state machine approves it. */
async function transitionTo(
  session: InterviewSession,
  to: InterviewStatus,
  extra: Partial<InterviewSession> = {}
): Promise<InterviewSession> {
  const from = statusOf(session);
  if (!from) throw new StateError(String(session.status), to);
  assertTransition(from, to);
  await db
    .update(interviewSessions)
    .set({ status: to, ...extra })
    .where(eq(interviewSessions.id, session.id));
  const updated = await findSession(session.id);
  if (!updated) throw new Error("Session vanished mid-transition.");
  return updated;
}

/** 404 for missing OR another user's session; null when the user is wrong. */
async function loadOwnedSession(
  req: Request,
  res: Response
): Promise<InterviewSession | null> {
  const userId = userIdOf(req);
  const id = parseIdParam(req.params.id);
  if (userId === null) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  if (id === null) {
    res.status(404).json({ error: "Interview not found." });
    return null;
  }
  const session = await findSession(id);
  if (!ownsSession(session, userId)) {
    res.status(404).json({ error: "Interview not found." });
    return null;
  }
  return session;
}

function cvSkillsOf(cv: Cv): string[] {
  const fields = cv.userCorrectedJson ?? cv.parsedJson;
  const skills = fields?.skills;
  return Array.isArray(skills) ? skills.filter((s) => typeof s === "string") : [];
}

// ---------------------------------------------------------------------------
// POST / — create a session + generate its questions (status: created)
// ---------------------------------------------------------------------------

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    if (userId === null) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const checked = validateInterviewCreateInput(req.body);
    if (!checked.ok || !checked.value) {
      res.status(400).json({ error: checked.error ?? "Invalid input." });
      return;
    }
    const v = checked.value;

    let jobTitle = "General";
    let requiredSkills: string[] = [];
    if (v.jobProfileId !== null) {
      const jp = await findJobProfile(v.jobProfileId);
      if (!ownsJobProfile(jp, userId)) {
        res.status(404).json({ error: "Job profile not found." });
        return;
      }
      jobTitle = jp.title;
      requiredSkills = jp.requiredSkills ?? [];
    }

    let cvSkills: string[] = [];
    if (v.cvId !== null) {
      const cv = await findCv(v.cvId);
      if (!ownsCv(cv, userId)) {
        res.status(404).json({ error: "CV not found." });
        return;
      }
      cvSkills = cvSkillsOf(cv);
    }

    const generated = await questionProvider.generateQuestions({
      jobTitle,
      requiredSkills,
      cvSkills,
      count: v.questionCount,
      interviewLanguage: v.interviewLanguage,
    });
    if (generated.length === 0) {
      res.status(500).json({ error: "Could not generate questions." });
      return;
    }

    await db.insert(interviewSessions).values({
      userId,
      jobProfileId: v.jobProfileId,
      cvId: v.cvId,
      interviewLanguage: v.interviewLanguage,
      responseLanguage: v.responseLanguage,
      feedbackLanguage: v.feedbackLanguage,
      evaluationLanguage: v.evaluationLanguage,
      status: "created",
      currentQuestionIndex: 0,
      totalQuestions: generated.length,
    });
    const session = (
      await db
        .select()
        .from(interviewSessions)
        .where(eq(interviewSessions.userId, userId))
        .orderBy(desc(interviewSessions.id))
        .limit(1)
    )[0];
    if (!session) {
      res.status(500).json({ error: "Internal server error." });
      return;
    }

    await db.insert(interviewQuestions).values(
      generated.map((q, i) => ({
        sessionId: session.id,
        orderIndex: i,
        category: q.category,
        questionText: q.text,
        rubricHints: q.rubricHints,
      }))
    );

    const questions = await getQuestions(session.id);
    res.status(201).json({
      session: toPublicSession(session),
      questions: questions.map(toPublicQuestion),
    });
  })
);

// ---------------------------------------------------------------------------
// GET / — list my sessions (newest first, optional ?status= filter)
// ---------------------------------------------------------------------------

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    if (userId === null) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { status } = req.query;
    if (status !== undefined && !isInterviewStatus(status)) {
      res.status(400).json({
        error:
          "Invalid status filter. Valid: created, asking, awaiting_answer, evaluating, completed, paused, interrupted, failed.",
      });
      return;
    }
    const rows = await db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, userId))
      .orderBy(desc(interviewSessions.createdAt));
    const filtered =
      status === undefined
        ? rows
        : rows.filter((r) => r.status === (status as string));
    res.status(200).json({ interviews: filtered.map(toPublicSession) });
  })
);

// ---------------------------------------------------------------------------
// GET /:id — full detail: session + questions, each with its answer (if any)
// ---------------------------------------------------------------------------

router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = await loadOwnedSession(req, res);
    if (!session) return;

    const questions = await getQuestions(session.id);
    const answers = await db
      .select()
      .from(interviewAnswers)
      .where(eq(interviewAnswers.sessionId, session.id));

    const answerByQuestion = new Map<number, InterviewAnswer>();
    for (const a of answers) answerByQuestion.set(a.questionId, a);

    const evalByAnswer = new Map<number, AnswerEvaluation>();
    if (answers.length > 0) {
      const evals = await db
        .select()
        .from(answerEvaluations)
        .where(
          inArray(
            answerEvaluations.answerId,
            answers.map((a) => a.id)
          )
        );
      for (const e of evals) evalByAnswer.set(e.answerId, e);
    }

    res.status(200).json({
      session: toPublicSession(session),
      questions: questions.map((q) => {
        const answer = answerByQuestion.get(q.id) ?? null;
        const evaluation = answer
          ? (evalByAnswer.get(answer.id) ?? null)
          : null;
        return {
          ...toPublicQuestion(q),
          answer: answer ? toPublicAnswer(answer) : null,
          evaluation: evaluation ? toPublicEvaluation(evaluation) : null,
        };
      }),
    });
  })
);

// ---------------------------------------------------------------------------
// POST /:id/start — created → asking → awaiting_answer (returns Q1)
// ---------------------------------------------------------------------------

router.post(
  "/:id/start",
  requireAuth,
  asyncHandler(async (req, res) => {
    let session = await loadOwnedSession(req, res);
    if (!session) return;
    try {
      session = await transitionTo(session, "asking", { startedAt: new Date() });
      session = await transitionTo(session, "awaiting_answer");
    } catch (err) {
      if (err instanceof StateError) {
        res.status(409).json({ error: err.message });
        return;
      }
      throw err;
    }
    const questions = await getQuestions(session.id);
    const first = questions[0] ?? null;
    res.status(200).json({
      session: toPublicSession(session),
      question: first ? toPublicQuestion(first) : null,
    });
  })
);

// ---------------------------------------------------------------------------
// POST /:id/answer — submit an answer for the current question
// ---------------------------------------------------------------------------

router.post(
  "/:id/answer",
  requireAuth,
  asyncHandler(async (req, res) => {
    let session = await loadOwnedSession(req, res);
    if (!session) return;

    if (statusOf(session) !== "awaiting_answer") {
      res.status(409).json({
        error: "An answer can only be submitted while a question is awaiting an answer.",
      });
      return;
    }
    const checked = validateAnswerInput(req.body);
    if (!checked.ok || !checked.value) {
      res.status(400).json({ error: checked.error ?? "Invalid input." });
      return;
    }

    const questions = await getQuestions(session.id);
    const current = questions[session.currentQuestionIndex] ?? null;
    if (!current) {
      res.status(409).json({ error: "No current question for this session." });
      return;
    }

    try {
      session = await transitionTo(session, "evaluating");
    } catch (err) {
      if (err instanceof StateError) {
        res.status(409).json({ error: err.message });
        return;
      }
      throw err;
    }

    try {
      await db.insert(interviewAnswers).values({
        questionId: current.id,
        sessionId: session.id,
        answerText: checked.value.answerText,
      });
    } catch (err) {
      // UNIQUE(questionId): a retry/double-submit after the first succeeded.
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Duplicate entry") || msg.includes("UNIQUE")) {
        res.status(409).json({ error: "Answer already submitted for this question." });
        return;
      }
      throw err;
    }

    const answer = (
      await db
        .select()
        .from(interviewAnswers)
        .where(eq(interviewAnswers.questionId, current.id))
        .limit(1)
    )[0];
    if (!answer) {
      res.status(500).json({ error: "Internal server error." });
      return;
    }

    let result;
    try {
      result = await answerEvaluator.evaluate({
        question: current.questionText,
        category: current.category as QuestionCategory,
        answerText: checked.value.answerText,
        rubricHints: current.rubricHints ?? [],
        feedbackLanguage: session.feedbackLanguage,
        evaluationLanguage: session.evaluationLanguage,
      });
    } catch {
      await transitionTo(session, "failed");
      res.status(500).json({ error: "Evaluation failed. The interview was marked as failed." });
      return;
    }

    await db.insert(answerEvaluations).values({
      answerId: answer.id,
      scores: result.scores,
      overallScore: result.overallScore.toFixed(2),
      feedbackText: result.feedbackText,
      strengths: result.strengths,
      improvements: result.improvements,
    });
    const evaluation = (
      await db
        .select()
        .from(answerEvaluations)
        .where(eq(answerEvaluations.answerId, answer.id))
        .limit(1)
    )[0];

    const nextIndex = session.currentQuestionIndex + 1;
    if (nextIndex < questions.length) {
      session = await transitionTo(session, "awaiting_answer", {
        currentQuestionIndex: nextIndex,
      });
      const next = questions[nextIndex];
      res.status(200).json({
        session: toPublicSession(session),
        answer: toPublicAnswer(answer),
        evaluation: evaluation ? toPublicEvaluation(evaluation) : null,
        nextQuestion: toPublicQuestion(next),
        completed: false,
      });
    } else {
      session = await transitionTo(session, "completed", {
        completedAt: new Date(),
      });
      res.status(200).json({
        session: toPublicSession(session),
        answer: toPublicAnswer(answer),
        evaluation: evaluation ? toPublicEvaluation(evaluation) : null,
        nextQuestion: null,
        completed: true,
      });
    }
  })
);

// ---------------------------------------------------------------------------
// POST /:id/pause | POST /:id/resume | POST /:id/interrupt
// ---------------------------------------------------------------------------

router.post(
  "/:id/pause",
  requireAuth,
  asyncHandler(async (req, res) => {
    let session = await loadOwnedSession(req, res);
    if (!session) return;
    try {
      session = await transitionTo(session, "paused");
    } catch (err) {
      if (err instanceof StateError) {
        res.status(409).json({ error: err.message });
        return;
      }
      throw err;
    }
    res.status(200).json({ session: toPublicSession(session) });
  })
);

router.post(
  "/:id/resume",
  requireAuth,
  asyncHandler(async (req, res) => {
    let session = await loadOwnedSession(req, res);
    if (!session) return;
    try {
      session = await transitionTo(session, "awaiting_answer");
    } catch (err) {
      if (err instanceof StateError) {
        res.status(409).json({ error: err.message });
        return;
      }
      throw err;
    }
    const questions = await getQuestions(session.id);
    const current = questions[session.currentQuestionIndex] ?? null;
    res.status(200).json({
      session: toPublicSession(session),
      question: current ? toPublicQuestion(current) : null,
    });
  })
);

router.post(
  "/:id/interrupt",
  requireAuth,
  asyncHandler(async (req, res) => {
    let session = await loadOwnedSession(req, res);
    if (!session) return;
    try {
      session = await transitionTo(session, "interrupted");
    } catch (err) {
      if (err instanceof StateError) {
        res.status(409).json({ error: err.message });
        return;
      }
      throw err;
    }
    res.status(200).json({ session: toPublicSession(session) });
  })
);

// ---------------------------------------------------------------------------
// GET /:id/report — aggregated report; every number computed from stored rows
// ---------------------------------------------------------------------------

router.get(
  "/:id/report",
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = await loadOwnedSession(req, res);
    if (!session) return;

    const questions = await getQuestions(session.id);
    const answers = await db
      .select()
      .from(interviewAnswers)
      .where(eq(interviewAnswers.sessionId, session.id));
    const answerByQuestion = new Map<number, InterviewAnswer>();
    for (const a of answers) answerByQuestion.set(a.questionId, a);

    const evalByAnswer = new Map<number, AnswerEvaluation>();
    if (answers.length > 0) {
      const evals = await db
        .select()
        .from(answerEvaluations)
        .where(
          inArray(
            answerEvaluations.answerId,
            answers.map((a) => a.id)
          )
        );
      for (const e of evals) evalByAnswer.set(e.answerId, e);
    }

    const perQuestion = questions.map((q) => {
      const answer = answerByQuestion.get(q.id) ?? null;
      const evaluation = answer ? (evalByAnswer.get(answer.id) ?? null) : null;
      return {
        orderIndex: q.orderIndex,
        category: q.category,
        questionText: q.questionText,
        answerText: answer?.answerText ?? null,
        answeredAt: answer?.answeredAt ?? null,
        scores: evaluation?.scores ?? null,
        overallScore: evaluation?.overallScore ?? null,
        feedbackText: evaluation?.feedbackText ?? null,
        strengths: evaluation?.strengths ?? [],
        improvements: evaluation?.improvements ?? [],
      };
    });

    const scored = perQuestion.filter(
      (p): p is typeof p & { scores: NonNullable<typeof p.scores> } =>
        p.scores !== null
    );
    const mean = (xs: number[]): number | null =>
      xs.length === 0
        ? null
        : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;

    const summary = {
      answered: answers.length,
      total: questions.length,
      overallMean: mean(
        scored.map((p) => parseFloat(String(p.overallScore ?? "0")))
      ),
      dimensionMeans: {
        relevance: mean(scored.map((p) => p.scores.relevance)),
        depth: mean(scored.map((p) => p.scores.depth)),
        clarity: mean(scored.map((p) => p.scores.clarity)),
        structure: mean(scored.map((p) => p.scores.structure)),
      },
    };

    res.status(200).json({
      session: toPublicSession(session),
      summary,
      questions: perQuestion,
      methodNote:
        "Scores come from a local template-based heuristic (see server/ai/templateProvider.ts), not human judgment.",
    });
  })
);

export default router;
