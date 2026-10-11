-- MockMate AI — 0003_interview: job profiles, interview sessions,
-- questions, answers, evaluations.
-- Hand-written to match drizzle/schema.ts exactly.
-- MySQL 8 / MariaDB 10.4+ (XAMPP) compatible. Idempotent.
--
-- Notes:
-- * FK columns are BIGINT UNSIGNED to match the `serial` (unsigned) PKs;
--   InnoDB requires the same signedness on both sides of a FK.
-- * `interview_sessions.status` is a plain varchar — the legal values
--   (created|asking|awaiting_answer|evaluating|completed|paused|interrupted|
--   failed) are enforced by the server-side state machine
--   (server/lib/interviewState.ts), not by the DB.
-- * `interview_answers.answerText` stores the user's ORIGINAL answer verbatim;
--   no normalization happens before storage (Phase D may add a separate
--   normalized column).
-- * JSON columns are JSON on MySQL 8 (LONGTEXT alias on MariaDB 10.4 —
--   drizzle parses the JSON on read either way).
CREATE TABLE IF NOT EXISTS `job_profiles` (
	`id` serial PRIMARY KEY NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`title` varchar(255) NOT NULL,
	`company` varchar(255),
	`description` text,
	`requiredSkills` json,
	`createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `job_profiles_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `interview_sessions` (
	`id` serial PRIMARY KEY NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`jobProfileId` bigint unsigned,
	`cvId` bigint unsigned,
	`interviewLanguage` varchar(32) NOT NULL DEFAULT 'en',
	`feedbackLanguage` varchar(32) NOT NULL DEFAULT 'en',
	`status` varchar(32) NOT NULL DEFAULT 'created',
	`currentQuestionIndex` int NOT NULL DEFAULT 0,
	`totalQuestions` int NOT NULL,
	`startedAt` timestamp NULL,
	`completedAt` timestamp NULL,
	`createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `interview_sessions_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `interview_sessions_job_fk` FOREIGN KEY (`jobProfileId`) REFERENCES `job_profiles`(`id`) ON DELETE SET NULL,
	CONSTRAINT `interview_sessions_cv_fk` FOREIGN KEY (`cvId`) REFERENCES `cvs`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `interview_questions` (
	`id` serial PRIMARY KEY NOT NULL,
	`sessionId` bigint unsigned NOT NULL,
	`orderIndex` int NOT NULL,
	`category` varchar(64) NOT NULL,
	`questionText` text NOT NULL,
	`rubricHints` json,
	`createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `interview_questions_session_fk` FOREIGN KEY (`sessionId`) REFERENCES `interview_sessions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `interview_answers` (
	`id` serial PRIMARY KEY NOT NULL,
	`questionId` bigint unsigned NOT NULL,
	`sessionId` bigint unsigned NOT NULL,
	`answerText` text NOT NULL,
	`answeredAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `interview_answers_question_fk` FOREIGN KEY (`questionId`) REFERENCES `interview_questions`(`id`) ON DELETE CASCADE,
	CONSTRAINT `interview_answers_question_uq` UNIQUE (`questionId`),
	CONSTRAINT `interview_answers_session_fk` FOREIGN KEY (`sessionId`) REFERENCES `interview_sessions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `answer_evaluations` (
	`id` serial PRIMARY KEY NOT NULL,
	`answerId` bigint unsigned NOT NULL,
	`scores` json NOT NULL,
	`overallScore` decimal(3,2),
	`feedbackText` text,
	`strengths` json,
	`improvements` json,
	`evaluatedAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `answer_evaluations_answer_fk` FOREIGN KEY (`answerId`) REFERENCES `interview_answers`(`id`) ON DELETE CASCADE,
	CONSTRAINT `answer_evaluations_answer_uq` UNIQUE (`answerId`)
);
