/**
 * Admin API (mounted at /api/v1/admin — every route requires requireAdmin).
 *
 * PRIVACY RULE (documented in README): admin endpoints expose session
 * METADATA only — never answer transcripts, question text, or CV file
 * contents. Admins manage accounts and review contact messages; they do not
 * get default access to what users said in interviews.
 *
 * Every mutation writes an audit_logs row (actor, action, target, metadata).
 * List endpoints are paginated (?page&limit, limit caps at 100).
 */
import { Router } from "express";
import type { Request } from "express";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "../../drizzle/db.js";
import {
  answerEvaluations,
  auditLogs,
  contactMessages,
  interviewAnswers,
  interviewSessions,
  isContactStatus,
  users,
} from "../../drizzle/schema.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { logAudit } from "../lib/audit.js";
import { parsePagination, validateRoleChange } from "../lib/adminGuards.js";
import { isInterviewStatus } from "../lib/interviewState.js";

const router = Router();

// Every /api/v1/admin route requires an admin session: 401 without a
// session, 403 { error: "Forbidden" } for non-admin users.
router.use(requireAdmin);

type PublicUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

function toPublicUser(row: typeof users.$inferSelect): PublicUser {
  // passwordHash is NEVER selected into these rows — see the explicit
  // column lists below. Belt and braces: the shape has no such field.
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

function parseIdParam(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(s);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function actorIdOf(req: Request): number {
  // requireAdmin guarantees req.user.
  return req.user!.id;
}

// ---------------------------------------------------------------------------
// GET /users — paginated user list (safe columns only, never passwordHash)
// ---------------------------------------------------------------------------

router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(users);
    res.status(200).json({
      users: rows,
      page,
      limit,
      total: Number(total),
    });
  })
);

// ---------------------------------------------------------------------------
// PATCH /users/:id/role — change a user's role, with safety guards
// ---------------------------------------------------------------------------

router.patch(
  "/users/:id/role",
  asyncHandler(async (req, res) => {
    const actorId = actorIdOf(req);
    const targetId = parseIdParam(req.params.id);
    if (targetId === null) {
      res.status(400).json({ error: "Invalid user id." });
      return;
    }
    const newRole: unknown = (req.body as Record<string, unknown> | null)
      ?.role;
    if (newRole !== "user" && newRole !== "admin") {
      res.status(400).json({ error: "Role must be 'user' or 'admin'." });
      return;
    }

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);
    const target = rows[0] ?? null;
    if (!target) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    if (target.role === newRole) {
      res.status(200).json({ user: toPublicUser(target) });
      return;
    }

    let adminCount = 0;
    if (target.role === "admin" && newRole === "user") {
      const [{ count: c }] = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.role, "admin"));
      adminCount = Number(c);
    }
    const guardError = validateRoleChange({
      targetUserId: target.id,
      targetRole: target.role,
      newRole,
      actorUserId: actorId,
      adminCount,
    });
    if (guardError) {
      res.status(400).json({ error: guardError });
      return;
    }

    await db.update(users).set({ role: newRole }).where(eq(users.id, targetId));
    await logAudit(actorId, "admin.user.role_changed", "user", targetId, {
      from: target.role,
      to: newRole,
    });
    res.status(200).json({ user: toPublicUser({ ...target, role: newRole }) });
  })
);

// ---------------------------------------------------------------------------
// GET /sessions — session METADATA only (?status=&userId= filters).
// Never returns transcripts, question text, or CV contents (privacy rule).
// ---------------------------------------------------------------------------

router.get(
  "/sessions",
  asyncHandler(async (req, res) => {
    const { status, userId } = req.query;
    if (status !== undefined && !isInterviewStatus(status)) {
      res.status(400).json({ error: "Invalid status filter." });
      return;
    }
    let userIdFilter: number | null = null;
    if (userId !== undefined) {
      const parsed = Number(userId);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        res.status(400).json({ error: "Invalid userId filter." });
        return;
      }
      userIdFilter = parsed;
    }
    const { page, limit, offset } = parsePagination(req.query);

    const conditions: SQL[] = [];
    if (status !== undefined) {
      conditions.push(eq(interviewSessions.status, status as string));
    }
    if (userIdFilter !== null) {
      conditions.push(eq(interviewSessions.userId, userIdFilter));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ count: total }] = await db
      .select({ count: count() })
      .from(interviewSessions)
      .where(where);

    const rows = await db
      .select({
        id: interviewSessions.id,
        userId: interviewSessions.userId,
        userEmail: users.email,
        status: interviewSessions.status,
        interviewLanguage: interviewSessions.interviewLanguage,
        feedbackLanguage: interviewSessions.feedbackLanguage,
        totalQuestions: interviewSessions.totalQuestions,
        startedAt: interviewSessions.startedAt,
        completedAt: interviewSessions.completedAt,
        createdAt: interviewSessions.createdAt,
      })
      .from(interviewSessions)
      .innerJoin(users, eq(interviewSessions.userId, users.id))
      .where(where)
      .orderBy(desc(interviewSessions.createdAt))
      .limit(limit)
      .offset(offset);

    // Per-session score summaries (answered count + mean overall score),
    // computed from stored evaluations — metadata only, no transcripts.
    const sessionIds = rows.map((r) => r.id);
    const summaryBySession = new Map<
      number,
      { answered: number; avgOverallScore: number | null }
    >();
    for (const id of sessionIds) {
      summaryBySession.set(id, { answered: 0, avgOverallScore: null });
    }
    if (sessionIds.length > 0) {
      const answers = await db
        .select({
          id: interviewAnswers.id,
          sessionId: interviewAnswers.sessionId,
        })
        .from(interviewAnswers)
        .where(inArray(interviewAnswers.sessionId, sessionIds));
      const sessionByAnswer = new Map(
        answers.map((a) => [a.id, a.sessionId] as const)
      );
      for (const a of answers) {
        summaryBySession.get(a.sessionId)!.answered += 1;
      }
      const answerIds = answers.map((a) => a.id);
      if (answerIds.length > 0) {
        const evals = await db
          .select({
            answerId: answerEvaluations.answerId,
            overallScore: answerEvaluations.overallScore,
          })
          .from(answerEvaluations)
          .where(inArray(answerEvaluations.answerId, answerIds));
        const scoresBySession = new Map<number, number[]>();
        for (const e of evals) {
          const sid = sessionByAnswer.get(e.answerId);
          if (sid === undefined || e.overallScore === null) continue;
          const score = parseFloat(String(e.overallScore));
          if (!Number.isFinite(score)) continue;
          const arr = scoresBySession.get(sid) ?? [];
          arr.push(score);
          scoresBySession.set(sid, arr);
        }
        for (const [sid, scores] of scoresBySession) {
          const mean =
            Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) /
            100;
          summaryBySession.get(sid)!.avgOverallScore = mean;
        }
      }
    }

    res.status(200).json({
      sessions: rows.map((r) => ({
        ...r,
        answered: summaryBySession.get(r.id)!.answered,
        avgOverallScore: summaryBySession.get(r.id)!.avgOverallScore,
      })),
      page,
      limit,
      total: Number(total),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /contact — contact messages (?status= filter)
// ---------------------------------------------------------------------------

router.get(
  "/contact",
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    if (status !== undefined && !isContactStatus(status)) {
      res
        .status(400)
        .json({ error: "Invalid status filter. Valid: new, reviewed, archived." });
      return;
    }
    const { page, limit, offset } = parsePagination(req.query);
    const where =
      status !== undefined
        ? eq(contactMessages.status, status as string)
        : undefined;

    const [{ count: total }] = await db
      .select({ count: count() })
      .from(contactMessages)
      .where(where);
    const rows = await db
      .select()
      .from(contactMessages)
      .where(where)
      .orderBy(desc(contactMessages.createdAt))
      .limit(limit)
      .offset(offset);
    res.status(200).json({
      messages: rows,
      page,
      limit,
      total: Number(total),
    });
  })
);

// ---------------------------------------------------------------------------
// PATCH /contact/:id — review / archive a message
// ---------------------------------------------------------------------------

router.patch(
  "/contact/:id",
  asyncHandler(async (req, res) => {
    const actorId = actorIdOf(req);
    const id = parseIdParam(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "Invalid message id." });
      return;
    }
    const newStatus: unknown = (req.body as Record<string, unknown> | null)
      ?.status;
    if (!isContactStatus(newStatus)) {
      res
        .status(400)
        .json({ error: "Status must be one of: new, reviewed, archived." });
      return;
    }

    const rows = await db
      .select()
      .from(contactMessages)
      .where(eq(contactMessages.id, id))
      .limit(1);
    const message = rows[0] ?? null;
    if (!message) {
      res.status(404).json({ error: "Message not found." });
      return;
    }
    if (message.status === newStatus) {
      res.status(200).json({ message });
      return;
    }

    await db
      .update(contactMessages)
      .set({ status: newStatus })
      .where(eq(contactMessages.id, id));
    await logAudit(actorId, "admin.contact.status_changed", "contact_message", id, {
      from: message.status,
      to: newStatus,
    });
    res.status(200).json({ message: { ...message, status: newStatus } });
  })
);

// ---------------------------------------------------------------------------
// GET /audit — audit trail (?action= exact-match filter)
// ---------------------------------------------------------------------------

router.get(
  "/audit",
  asyncHandler(async (req, res) => {
    const { action } = req.query;
    const { page, limit, offset } = parsePagination(req.query);
    const where =
      typeof action === "string" && action.length > 0
        ? eq(auditLogs.action, action)
        : undefined;

    const [{ count: total }] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(where);
    const rows = await db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(limit)
      .offset(offset);
    res.status(200).json({
      logs: rows,
      page,
      limit,
      total: Number(total),
    });
  })
);

export default router;
