-- MockMate AI — 0009_practice: English communication practice attempts.
-- Hand-written to match drizzle/schema.ts exactly.
--
-- `practice_attempts` stores one submitted exercise: the prompt, the user's
-- text, and the feedback given (with the producing engine recorded in the
-- JSON). History and trends are computed from these rows. Re-runnable:
-- IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS `practice_attempts` (
  `id` bigint AUTO_INCREMENT NOT NULL,
  `userId` bigint NOT NULL,
  `exerciseType` varchar(32) NOT NULL,
  `prompt` text NOT NULL,
  `userText` text NOT NULL,
  `feedback` json,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT `practice_attempts_id` PRIMARY KEY(`id`),
  CONSTRAINT `practice_attempts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
);
