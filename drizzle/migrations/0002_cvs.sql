-- MockMate AI — 0002_cvs: CV uploads table.
-- Hand-written to match drizzle/schema.ts exactly.
-- MySQL 8 / MariaDB 10.4+ (XAMPP) compatible. Idempotent.
--
-- Notes:
-- * `userId` is BIGINT UNSIGNED to match the `serial` (unsigned) PK of
--   `users`; InnoDB requires the same signedness on both sides of a FK.
--   (drizzle's bigint() builder has no unsigned modifier, so a future
--   `pnpm db:generate` may flag a signedness diff here — the SQL below is
--   the source of truth.)
-- * `parsedJson` / `userCorrectedJson` are JSON on MySQL 8 (LONGTEXT alias
--   on MariaDB 10.4 — drizzle parses the JSON on read either way).
CREATE TABLE IF NOT EXISTS `cvs` (
	`id` serial PRIMARY KEY NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`originalFilename` varchar(255) NOT NULL,
	`storedPath` varchar(512) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSize` int NOT NULL,
	`status` enum('uploaded','processing','ready','failed') NOT NULL DEFAULT 'uploaded',
	`parsedJson` json,
	`userCorrectedJson` json,
	`errorMessage` varchar(1024),
	`createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `cvs_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

--> statement-breakpoint
