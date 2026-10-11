-- MockMate AI — 0004_languages: per-user language settings +
-- the two remaining per-session language columns (responseLanguage,
-- evaluationLanguage). Phase D.
-- Hand-written to match drizzle/schema.ts exactly.
-- MySQL 8 / MariaDB 10.4+ (XAMPP) compatible.
--
-- IDEMPOTENCY NOTES (read before re-running by hand):
-- * `user_language_settings` uses CREATE TABLE IF NOT EXISTS — safe to
--   re-run.
-- * MySQL has no `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so the two
--   ALTERs are guarded by a stored procedure that checks
--   information_schema.COLUMNS first. The procedure is created, called, and
--   dropped inside this migration, so re-running is a no-op for columns
--   that already exist. (DELIMITER is a mysql-CLI concept only; the server
--   parses the procedure body sent as one statement just fine.)
-- * Normal path: drizzle-kit applies each migration exactly once (tracked in
--   __drizzle_migrations), so these guards only matter for manual re-runs.
--
-- STATEMENT SPLITTING: drizzle's migrator splits a migration file on
-- "statement-breakpoint" marker comments. Every statement below is separated
-- by one — do not remove them, or multi-statement files silently execute only
-- their first statement.
CREATE TABLE IF NOT EXISTS `user_language_settings` (
	`userId` bigint unsigned NOT NULL,
	`interviewLanguage` varchar(32) NOT NULL DEFAULT 'en',
	`responseLanguage` varchar(32) NOT NULL DEFAULT 'en',
	`feedbackLanguage` varchar(32) NOT NULL DEFAULT 'en',
	`evaluationLanguage` varchar(32) NOT NULL DEFAULT 'en',
	`updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `user_language_settings_pkey` PRIMARY KEY (`userId`),
	CONSTRAINT `user_language_settings_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
DROP PROCEDURE IF EXISTS `sp_0004_add_session_lang_cols`;
--> statement-breakpoint
CREATE PROCEDURE `sp_0004_add_session_lang_cols`()
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE()
		  AND TABLE_NAME = 'interview_sessions'
		  AND COLUMN_NAME = 'responseLanguage'
	) THEN
		ALTER TABLE `interview_sessions` ADD COLUMN `responseLanguage` varchar(32) NOT NULL DEFAULT 'en';
	END IF;
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE()
		  AND TABLE_NAME = 'interview_sessions'
		  AND COLUMN_NAME = 'evaluationLanguage'
	) THEN
		ALTER TABLE `interview_sessions` ADD COLUMN `evaluationLanguage` varchar(32) NOT NULL DEFAULT 'en';
	END IF;
END;
--> statement-breakpoint
CALL `sp_0004_add_session_lang_cols`();
--> statement-breakpoint
DROP PROCEDURE IF EXISTS `sp_0004_add_session_lang_cols`;
