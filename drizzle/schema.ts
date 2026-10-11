import {
  bigint,
  decimal,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Phase 0 schema: users only. Additional tables (profiles, CVs, job profiles,
 * interview sessions, questions, answers, evaluations) arrive with their
 * implementation phases, each with its own migration.
 */
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  role: varchar("role", { length: 32 }).notNull().default("user"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * Phase B schema: CV uploads.
 *
 * `storedPath` is a server-side private path relative to the project root —
 * it is never exposed through the API (see toPublicCv in server/routes/cvs.ts)
 * and the directory is never served statically.
 * `parsedJson` holds the rules-based parser output (with an honest
 * confidence label); `userCorrectedJson` holds the user's reviewed/corrected
 * fields. Both are nullable: a failed parse stores nothing, never invented data.
 */
export const cvs = mysqlTable("cvs", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  originalFilename: varchar("originalFilename", { length: 255 }).notNull(),
  storedPath: varchar("storedPath", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileSize: int("fileSize").notNull(),
  status: mysqlEnum("status", ["uploaded", "processing", "ready", "failed"])
    .notNull()
    .default("uploaded"),
  parsedJson: json("parsedJson").$type<CvParsedPayload | null>(),
  userCorrectedJson: json("userCorrectedJson").$type<CvFields | null>(),
  errorMessage: varchar("errorMessage", { length: 1024 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Cv = typeof cvs.$inferSelect;
export type NewCv = typeof cvs.$inferInsert;

/** Extracted / corrected CV fields. Every scalar is nullable — unknown stays unknown. */
export interface CvFields {
  name: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  education: string[];
  experienceYears: number | null;
}

/** Parser output: the fields plus an honest confidence label. */
export interface CvParsedPayload extends CvFields {
  confidence: "low" | "medium";
}

/**
 * Phase C schema: text-interview core loop.
 *
 * `job_profiles` — the role the user is practicing for (title/company/
 * description/required skills). Sessions optionally reference one.
 *
 * `interview_sessions` — one mock interview. `status` is a plain varchar;
 * the legal values are enforced by the server-side state machine
 * (server/lib/interviewState.ts), deliberately NOT by a DB enum, so the
 * machine is the single source of truth for transitions.
 * `currentQuestionIndex` points at the question awaiting an answer.
 *
 * `interview_questions` — the questions generated for a session, in
 * `orderIndex` order. `category` is one of
 * introduction|technical|behavioral|situational.
 *
 * `interview_answers` — exactly one row per question (UNIQUE on questionId).
 * `answerText` is the user's ORIGINAL answer, stored verbatim — no
 * normalization before storage.
 *
 * `answer_evaluations` — exactly one heuristic evaluation per answer.
 * `scores` is { relevance, depth, clarity, structure }, each 1–5.
 */
export const jobProfiles = mysqlTable("job_profiles", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  description: text("description"),
  requiredSkills: json("requiredSkills").$type<string[] | null>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type JobProfile = typeof jobProfiles.$inferSelect;
export type NewJobProfile = typeof jobProfiles.$inferInsert;

export const interviewSessions = mysqlTable("interview_sessions", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  jobProfileId: bigint("jobProfileId", { mode: "number" }).references(
    () => jobProfiles.id,
    { onDelete: "set null" }
  ),
  cvId: bigint("cvId", { mode: "number" }).references(() => cvs.id, {
    onDelete: "set null",
  }),
  interviewLanguage: varchar("interviewLanguage", { length: 32 })
    .notNull()
    .default("en"),
  feedbackLanguage: varchar("feedbackLanguage", { length: 32 })
    .notNull()
    .default("en"),
  /**
   * Phase D: the remaining two of the four language settings, stored per
   * session. `responseLanguage` is what the candidate answered in (a promise,
   * not a lock — answers are stored verbatim regardless). `evaluationLanguage`
   * selects the rubric-keyword list used for relevance scoring.
   */
  responseLanguage: varchar("responseLanguage", { length: 32 })
    .notNull()
    .default("en"),
  evaluationLanguage: varchar("evaluationLanguage", { length: 32 })
    .notNull()
    .default("en"),
  status: varchar("status", { length: 32 }).notNull().default("created"),
  currentQuestionIndex: int("currentQuestionIndex").notNull().default(0),
  totalQuestions: int("totalQuestions").notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InterviewSession = typeof interviewSessions.$inferSelect;
export type NewInterviewSession = typeof interviewSessions.$inferInsert;

export const interviewQuestions = mysqlTable("interview_questions", {
  id: serial("id").primaryKey(),
  sessionId: bigint("sessionId", { mode: "number" })
    .notNull()
    .references(() => interviewSessions.id, { onDelete: "cascade" }),
  orderIndex: int("orderIndex").notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  questionText: text("questionText").notNull(),
  rubricHints: json("rubricHints").$type<string[] | null>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InterviewQuestion = typeof interviewQuestions.$inferSelect;
export type NewInterviewQuestion = typeof interviewQuestions.$inferInsert;

export const interviewAnswers = mysqlTable("interview_answers", {
  id: serial("id").primaryKey(),
  questionId: bigint("questionId", { mode: "number" })
    .notNull()
    .references(() => interviewQuestions.id, { onDelete: "cascade" })
    .unique(),
  sessionId: bigint("sessionId", { mode: "number" })
    .notNull()
    .references(() => interviewSessions.id, { onDelete: "cascade" }),
  answerText: text("answerText").notNull(),
  answeredAt: timestamp("answeredAt").defaultNow().notNull(),
});

export type InterviewAnswer = typeof interviewAnswers.$inferSelect;
export type NewInterviewAnswer = typeof interviewAnswers.$inferInsert;

/** Rubric dimensions for an answer evaluation — each scored 1–5. */
export interface EvaluationScores {
  relevance: number;
  depth: number;
  clarity: number;
  structure: number;
}

export const answerEvaluations = mysqlTable("answer_evaluations", {
  id: serial("id").primaryKey(),
  answerId: bigint("answerId", { mode: "number" })
    .notNull()
    .references(() => interviewAnswers.id, { onDelete: "cascade" })
    .unique(),
  scores: json("scores").$type<EvaluationScores>().notNull(),
  overallScore: decimal("overallScore", { precision: 3, scale: 2 }),
  feedbackText: text("feedbackText"),
  strengths: json("strengths").$type<string[] | null>(),
  improvements: json("improvements").$type<string[] | null>(),
  evaluatedAt: timestamp("evaluatedAt").defaultNow().notNull(),
});

export type AnswerEvaluation = typeof answerEvaluations.$inferSelect;
export type NewAnswerEvaluation = typeof answerEvaluations.$inferInsert;

/**
 * Phase D schema: per-user language settings.
 *
 * The four settings (interview / response / feedback / evaluation language)
 * are persisted here per user as defaults for new sessions, AND copied onto
 * each interview_sessions row so a session's behavior never changes if the
 * user later edits their defaults. One row per user (PK on userId).
 */
export const userLanguageSettings = mysqlTable("user_language_settings", {
  userId: bigint("userId", { mode: "number" })
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  interviewLanguage: varchar("interviewLanguage", { length: 32 })
    .notNull()
    .default("en"),
  responseLanguage: varchar("responseLanguage", { length: 32 })
    .notNull()
    .default("en"),
  feedbackLanguage: varchar("feedbackLanguage", { length: 32 })
    .notNull()
    .default("en"),
  evaluationLanguage: varchar("evaluationLanguage", { length: 32 })
    .notNull()
    .default("en"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserLanguageSettings =
  typeof userLanguageSettings.$inferSelect;
export type NewUserLanguageSettings =
  typeof userLanguageSettings.$inferInsert;

/**
 * Phase F schema: admin audit log + public contact messages.
 *
 * `audit_logs` records every admin mutation (who did what to whom, when).
 * `actorUserId` is nullable — NULL means the action came from the system
 * itself (or the actor's row was later deleted; ON DELETE SET NULL).
 * `targetId` is a string on purpose: targets are not always numeric rows.
 *
 * `contact_messages.status` is a plain varchar validated in code
 * (new|reviewed|archived), deliberately not a DB enum — same convention as
 * interview_sessions.status, so the code is the single source of truth.
 */
export const auditLogs = mysqlTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: bigint("actorUserId", { mode: "number" }).references(
    () => users.id,
    { onDelete: "set null" }
  ),
  action: varchar("action", { length: 100 }).notNull(),
  targetType: varchar("targetType", { length: 64 }),
  targetId: varchar("targetId", { length: 64 }),
  metadata: json("metadata").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export const contactMessages = mysqlTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("new"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContactMessage = typeof contactMessages.$inferSelect;
export type NewContactMessage = typeof contactMessages.$inferInsert;

/** Legal contact-message statuses — enforced in code, not by a DB enum. */
export const CONTACT_STATUSES = ["new", "reviewed", "archived"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export function isContactStatus(value: unknown): value is ContactStatus {
  return (
    typeof value === "string" &&
    (CONTACT_STATUSES as readonly string[]).includes(value)
  );
}
