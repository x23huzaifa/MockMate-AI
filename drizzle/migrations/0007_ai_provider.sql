-- MockMate AI — 0007_ai_provider: record which AI engine produced what.
-- Hand-written to match drizzle/schema.ts exactly.
--
-- * `interview_sessions.questionProvider` — "gemini" | "template" for the
--   engine that generated the session's questions.
-- * `answer_evaluations.provider` — "gemini" | "template" for the engine
--   that evaluated the answer.
-- * Both columns are NULLABLE: pre-existing rows keep NULL, which the app
--   treats as "template" (the only engine that existed before).
-- * MariaDB 10.4+ (XAMPP) supports ADD COLUMN IF NOT EXISTS, making this
--   safe to re-run by hand. On MySQL 8, drop the IF NOT EXISTS keywords.
--   The drizzle journal also guards against double application.
--
-- STATEMENT SPLITTING: drizzle's migrator splits a migration file on
-- "statement-breakpoint" marker comments. Every statement below is separated
-- by one — do not remove them, or multi-statement files silently execute only
-- their first statement.
ALTER TABLE `interview_sessions` ADD COLUMN IF NOT EXISTS `questionProvider` varchar(16);
--> statement-breakpoint
ALTER TABLE `answer_evaluations` ADD COLUMN IF NOT EXISTS `provider` varchar(16);
