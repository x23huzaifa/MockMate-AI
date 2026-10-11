-- MockMate AI — 0005_admin: audit_logs + contact_messages. Phase F.
-- Hand-written to match drizzle/schema.ts exactly.
-- MySQL 8 / MariaDB 10.4+ (XAMPP) compatible.
--
-- * `audit_logs.actorUserId` is nullable: NULL means the action was performed
--   by the system (or the actor row was deleted — ON DELETE SET NULL).
-- * `contact_messages.status` is a plain varchar validated in code
--   (new|reviewed|archived), deliberately not a DB enum — same convention as
--   interview_sessions.status.
-- * Both tables use CREATE TABLE IF NOT EXISTS — safe to re-run by hand.
--
-- STATEMENT SPLITTING: drizzle's migrator splits a migration file on
-- "statement-breakpoint" marker comments. Every statement below is separated
-- by one — do not remove them, or multi-statement files silently execute only
-- their first statement.
CREATE TABLE IF NOT EXISTS `audit_logs` (
	`id` serial PRIMARY KEY NOT NULL,
	`actorUserId` bigint unsigned,
	`action` varchar(100) NOT NULL,
	`targetType` varchar(64),
	`targetId` varchar(64),
	`metadata` json,
	`createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `audit_logs_actor_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `contact_messages` (
	`id` serial PRIMARY KEY NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'new',
	`createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
