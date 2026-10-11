-- MockMate AI — 0006_chat: chat_conversations + chat_messages. Gemini AI career chat.
-- Hand-written to match drizzle/schema.ts exactly.
-- MySQL 8 / MariaDB 10.4+ (XAMPP) compatible.
--
-- * `chat_conversations.userId` → users(id) ON DELETE CASCADE: deleting a
--   user removes their chats. `chat_messages.conversationId` → cascade:
--   deleting a conversation removes its messages.
-- * `chat_messages.role` is a real DB enum (user|assistant) — a closed set
--   the app never extends at runtime (unlike status-style varchars).
-- * Both tables use CREATE TABLE IF NOT EXISTS — safe to re-run by hand.
--
-- STATEMENT SPLITTING: drizzle's migrator splits a migration file on
-- "statement-breakpoint" marker comments. Every statement below is separated
-- by one — do not remove them, or multi-statement files silently execute only
-- their first statement.
CREATE TABLE IF NOT EXISTS `chat_conversations` (
	`id` serial PRIMARY KEY NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`title` varchar(200) NOT NULL DEFAULT 'New chat',
	`createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `chat_conversations_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chat_messages` (
	`id` serial PRIMARY KEY NOT NULL,
	`conversationId` bigint unsigned NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `chat_messages_conversation_fk` FOREIGN KEY (`conversationId`) REFERENCES `chat_conversations`(`id`) ON DELETE CASCADE
);
