/**
 * AI career chat API (mounted at /api/v1/chat, all endpoints require auth).
 *
 * - GET  /status                    → { configured, provider, model } (UI banner)
 * - POST /conversations             → create a conversation
 * - GET  /conversations             → list mine (?limit=, ?offset=, newest first)
 * - GET  /conversations/:id         → conversation + its messages
 * - POST /conversations/:id/messages → { content } → saves the user message,
 *                                      calls Gemini, saves + returns the reply
 * - DELETE /conversations/:id      → delete conversation + messages
 *
 * Every :id endpoint returns 404 "Conversation not found." for both missing
 * rows and other users' rows (no IDOR leak) via ownsConversation().
 *
 * HONESTY: unlike interviews, chat has NO template fallback — a canned
 * "AI" would be dishonest. Unconfigured → 503 with setup guidance;
 * quota-exhausted → 429 with a friendly retry message.
 *
 * Rate limit: 30 messages/hour per user (each message = one LLM call),
 * keyed by user id. See server/lib/rateLimit.ts.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "../../drizzle/db.js";
import {
  chatConversations,
  chatMessages,
  type ChatConversation,
} from "../../drizzle/schema.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { chatLimiter } from "../lib/rateLimit.js";
import { aiStatus } from "../ai/index.js";
import { chatReply, isChatConfigured } from "../ai/chatProvider.js";
import {
  AIConfigError,
  AIQuotaExceededError,
  AIResponseError,
} from "../ai/errors.js";

const router = Router();

export const CHAT_MESSAGE_MAX_LENGTH = 4000;
export const CHAT_TITLE_MAX_LENGTH = 200;
export const CHAT_LIST_DEFAULT_LIMIT = 20;
export const CHAT_LIST_MAX_LIMIT = 100;
export const CHAT_CONTEXT_MESSAGES = 20;

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// ---------------------------------------------------------------------------

function userIdOf(req: Request): number | null {
  return req.user?.id ?? null;
}

function parseIdParam(raw: string | string[]): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(s);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Ownership gate: missing row OR another user's row → not owned. */
export function ownsConversation(
  conv: ChatConversation | null | undefined,
  userId: number
): conv is ChatConversation {
  return !!conv && conv.userId === userId;
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

export function validateConversationInput(
  body: unknown
): ValidationResult<{ title: string }> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid input." };
  }
  const raw = (body as { title?: unknown }).title;
  if (raw === undefined) return { ok: true, value: { title: "New chat" } };
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { ok: false, error: "Title must be a non-empty string." };
  }
  if (raw.trim().length > CHAT_TITLE_MAX_LENGTH) {
    return {
      ok: false,
      error: `Title must be at most ${CHAT_TITLE_MAX_LENGTH} characters.`,
    };
  }
  return { ok: true, value: { title: raw.trim() } };
}

export function validateMessageInput(
  body: unknown
): ValidationResult<{ content: string; language?: string }> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid input." };
  }
  const b = body as { content?: unknown; language?: unknown };
  if (typeof b.content !== "string" || b.content.trim().length === 0) {
    return { ok: false, error: "Message content is required." };
  }
  if (b.content.length > CHAT_MESSAGE_MAX_LENGTH) {
    return {
      ok: false,
      error: `Message must be at most ${CHAT_MESSAGE_MAX_LENGTH} characters.`,
    };
  }
  if (
    b.language !== undefined &&
    !["en", "ur", "roman-ur"].includes(String(b.language))
  ) {
    return { ok: false, error: "Invalid language. Use en, ur, or roman-ur." };
  }
  return {
    ok: true,
    value: {
      content: b.content.trim(),
      language:
        b.language === undefined ? undefined : String(b.language),
    },
  };
}

/** 503 payload when no AI provider is configured — honest, actionable. */
export function unconfiguredBody(): { error: string; hint: string } {
  return {
    error: "AI chat is not configured.",
    hint: "Set AI_PROVIDER=gemini and GEMINI_API_KEY in .env — see AI_SETUP.md in the project repo.",
  };
}

export function toPublicConversation(row: ChatConversation) {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toPublicMessage(row: {
  id: number;
  role: string;
  content: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt,
  };
}

function autoTitle(content: string): string {
  const t = content.replace(/\s+/g, " ").trim();
  return t.length <= 60 ? t : `${t.slice(0, 57)}…`;
}

// ---------------------------------------------------------------------------
// Internal data access
// ---------------------------------------------------------------------------

async function findConversation(
  id: number
): Promise<ChatConversation | null> {
  const rows = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** 404 for missing OR another user's conversation; null when unauthorized. */
async function loadOwnedConversation(
  req: Request,
  res: Response
): Promise<ChatConversation | null> {
  const userId = userIdOf(req);
  const id = parseIdParam(req.params.id);
  if (userId === null) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  if (id === null) {
    res.status(404).json({ error: "Conversation not found." });
    return null;
  }
  const conv = await findConversation(id);
  if (!ownsConversation(conv, userId)) {
    res.status(404).json({ error: "Conversation not found." });
    return null;
  }
  return conv;
}

// ---------------------------------------------------------------------------
// GET /status — provider status for the UI banner (auth required)
// ---------------------------------------------------------------------------

router.get(
  "/status",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.status(200).json(aiStatus());
  })
);

// ---------------------------------------------------------------------------
// POST /conversations — create
// ---------------------------------------------------------------------------

router.post(
  "/conversations",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    if (userId === null) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const checked = validateConversationInput(req.body);
    if (!checked.ok || !checked.value) {
      res.status(400).json({ error: checked.error ?? "Invalid input." });
      return;
    }
    await db
      .insert(chatConversations)
      .values({ userId, title: checked.value.title });
    const created = (
      await db
        .select()
        .from(chatConversations)
        .where(eq(chatConversations.userId, userId))
        .orderBy(desc(chatConversations.id))
        .limit(1)
    )[0];
    if (!created) {
      res.status(500).json({ error: "Internal server error." });
      return;
    }
    res.status(201).json({ conversation: toPublicConversation(created) });
  })
);

// ---------------------------------------------------------------------------
// GET /conversations — list mine, newest first, paginated
// ---------------------------------------------------------------------------

router.get(
  "/conversations",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    if (userId === null) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const rawLimit = Number(req.query.limit ?? CHAT_LIST_DEFAULT_LIMIT);
    const rawOffset = Number(req.query.offset ?? 0);
    const limit = Number.isInteger(rawLimit)
      ? Math.min(CHAT_LIST_MAX_LIMIT, Math.max(1, rawLimit))
      : CHAT_LIST_DEFAULT_LIMIT;
    const offset =
      Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
    const rows = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.userId, userId))
      .orderBy(desc(chatConversations.updatedAt))
      .limit(limit)
      .offset(offset);
    res.status(200).json({
      conversations: rows.map(toPublicConversation),
      limit,
      offset,
    });
  })
);

// ---------------------------------------------------------------------------
// GET /conversations/:id — detail + messages
// ---------------------------------------------------------------------------

router.get(
  "/conversations/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const conv = await loadOwnedConversation(req, res);
    if (!conv) return;
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conv.id))
      .orderBy(asc(chatMessages.id));
    res.status(200).json({
      conversation: toPublicConversation(conv),
      messages: messages.map(toPublicMessage),
    });
  })
);

// ---------------------------------------------------------------------------
// POST /conversations/:id/messages — chat turn
// ---------------------------------------------------------------------------

router.post(
  "/conversations/:id/messages",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    if (userId === null) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const conv = await loadOwnedConversation(req, res);
    if (!conv) return;

    const rateKey = `chat:${userId}`;
    if (chatLimiter.isLimited(rateKey)) {
      res.set("Retry-After", String(chatLimiter.retryAfterSeconds(rateKey)));
      res.status(429).json({
        error:
          "Too many chat messages. Please wait a while before sending another.",
      });
      return;
    }

    const checked = validateMessageInput(req.body);
    if (!checked.ok || !checked.value) {
      res.status(400).json({ error: checked.error ?? "Invalid input." });
      return;
    }

    if (!isChatConfigured()) {
      res.status(503).json(unconfiguredBody());
      return;
    }

    chatLimiter.record(rateKey);

    await db.insert(chatMessages).values({
      conversationId: conv.id,
      role: "user",
      content: checked.value.content,
    });

    // Recent history for context (bounded — never the whole table).
    const history = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conv.id))
      .orderBy(desc(chatMessages.id))
      .limit(CHAT_CONTEXT_MESSAGES);
    history.reverse();

    let reply: string;
    try {
      reply = await chatReply(
        history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { language: checked.value.language }
      );
    } catch (err) {
      if (err instanceof AIQuotaExceededError) {
        res.status(429).json({
          error: "AI is busy, try again in a moment.",
        });
        return;
      }
      if (err instanceof AIConfigError) {
        res.status(503).json(unconfiguredBody());
        return;
      }
      if (err instanceof AIResponseError) {
        res.status(502).json({
          error: "The AI gave an unusable reply. Please try again.",
        });
        return;
      }
      throw err;
    }

    await db.insert(chatMessages).values({
      conversationId: conv.id,
      role: "assistant",
      content: reply,
    });
    const assistantMessage = (
      await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, conv.id))
        .orderBy(desc(chatMessages.id))
        .limit(1)
    )[0];

    // Auto-title untitled conversations from the first user message.
    if (conv.title === "New chat") {
      await db
        .update(chatConversations)
        .set({ title: autoTitle(checked.value.content) })
        .where(eq(chatConversations.id, conv.id));
    } else {
      await db
        .update(chatConversations)
        .set({ updatedAt: new Date() })
        .where(eq(chatConversations.id, conv.id));
    }

    res.status(201).json({
      assistantMessage: assistantMessage
        ? toPublicMessage(assistantMessage)
        : null,
    });
  })
);

// ---------------------------------------------------------------------------
// DELETE /conversations/:id
// ---------------------------------------------------------------------------

router.delete(
  "/conversations/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const conv = await loadOwnedConversation(req, res);
    if (!conv) return;
    await db
      .delete(chatConversations)
      .where(eq(chatConversations.id, conv.id));
    res.status(200).json({ ok: true });
  })
);

export default router;
