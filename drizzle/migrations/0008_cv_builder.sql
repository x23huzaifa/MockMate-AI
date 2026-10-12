-- MockMate AI — 0008_cv_builder: AI CV Builder documents.
-- Hand-written to match drizzle/schema.ts exactly.
--
-- `cv_documents` stores user-built CVs (structured JSON content + template
-- choice). This is separate from `cvs` (uploaded files). Rows are owned by
-- users; deleting a user cascades. Re-runnable: IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS `cv_documents` (
  `id` bigint AUTO_INCREMENT NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `title` varchar(200) NOT NULL DEFAULT 'Untitled CV',
  `template` varchar(32) NOT NULL DEFAULT 'modern',
  `content` json,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT `cv_documents_id` PRIMARY KEY(`id`),
  CONSTRAINT `cv_documents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
);
