-- MockMate AI — 0001_init: users table.
-- Hand-written to match drizzle/schema.ts exactly.
-- Runs cleanly on MySQL 8 and MariaDB 10.4+ (XAMPP) from an empty database.
CREATE TABLE IF NOT EXISTS `users` (
	`id` serial PRIMARY KEY NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`role` varchar(32) NOT NULL DEFAULT 'user',
	`createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
