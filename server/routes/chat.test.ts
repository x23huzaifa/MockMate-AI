/**
 * Tests for the AI chat routes (server/routes/chat.ts).
 *
 * The DB, auth middleware, and Gemini client are faked:
 * - drizzle/db.js → in-memory store (no MySQL, no env vars needed)
 * - requireAuth → test double reading req.__testUser (401 when absent)
 * - ai/chatProvider.js → vi.fn()s (no network)
 *
 * What IS real: the router, the ownership gates (ownsConversation),
 * validation, rate limiting, and the 503/429/404 status mapping.
 *
 * Test limitation (documented): the fake db's where() is a no-op, so
 * per-user list filtering is done by the DB in production and asserted
 * here only via the ownsConversation gate on :id routes, which is the
 * actual security boundary.
 *
 * Run: pnpm test
 * Status: WRITTEN, NOT EXECUTED in this environment (no node_modules here).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";

vi.mock("../../drizzle/db.js", () => {
  const store = {
    conversations: [] as Record<string, any>[],
    messages: [] as Record<string, any>[],
    nextConvId: 1,
    nextMsgId: 1,
  };
  function tableName(t: unknown): string {
    try {
      return getTableName(t as any);
    } catch {
      return "unknown";
    }
  }
  function chain(rows: Record<string, any>[]) {
    const c: any = {
      _rows: [...rows],
      where() {
        return c;
      },
      orderBy() {
        return c;
      },
      limit(n: number) {
        c._rows = c._rows.slice(0, n);
        return c;
      },
      offset(n: number) {
        c._rows = c._rows.slice(n);
        return c;
      },
      then(res: (v: unknown) => void) {
        return Promise.resolve(c._rows).then(res);
      },
    };
    return c;
  }
  const db = {
    select: () => ({
      from: (table: unknown) =>
        chain(
          tableName(table) === "chat_messages"
            ? store.messages
            : store.conversations
        ),
    }),
    insert: (table: unknown) => ({
      values: (v: Record<string, any>) => {
        if (tableName(table) === "chat_messages") {
          store.messages.push({
            id: store.nextMsgId++,
            conversationId: v.conversationId,
            role: v.role,
            content: v.content,
            createdAt: new Date(),
          });
        } else {
          store.conversations.push({
            id: store.nextConvId++,
            userId: v.userId,
            title: v.title,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        return Promise.resolve([]);
      },
    }),
    update: () => ({
      set: (patch: Record<string, any>) => ({
        where() {
          // Tests seed exactly one conversation per case.
          for (const r of store.conversations) Object.assign(r, patch);
          return Promise.resolve([]);
        },
      }),
    }),
    delete: () => ({
      where() {
        store.conversations.length = 0;
        store.messages.length = 0;
        return Promise.resolve([]);
      },
    }),
  };
  return { db, __chatTestStore: store };
});

vi.mock("../middleware/requireAuth.js", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const u = req.__testUser;
    if (!u) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.user = u;
    next();
  },
}));

const mockChatReply = vi.fn();
const mockIsChatConfigured = vi.fn();
vi.mock("../ai/chatProvider.js", () => ({
  chatReply: (...args: any[]) => mockChatReply(...args),
  isChatConfigured: (...args: any[]) => mockIsChatConfigured(...args),
}));

import router, {
  ownsConversation,
  unconfiguredBody,
  validateConversationInput,
  validateMessageInput,
} from "./chat.js";
import { chatLimiter } from "../lib/rateLimit.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function store() {
  const mod = (await import("../../drizzle/db.js")) as any;
  return mod.__chatTestStore as {
    conversations: Record<string, any>[];
    messages: Record<string, any>[];
    nextConvId: number;
    nextMsgId: number;
  };
}

function req(
  method: string,
  url: string,
  opts: { user?: any; body?: any; query?: any } = {}
): any {
  return {
    method,
    url,
    params: {},
    query: opts.query ?? {},
    body: opts.body,
    cookies: {},
    headers: {},
    ip: "127.0.0.1",
    __testUser: opts.user,
  };
}

function res(): any {
  const r: any = {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string>,
    status(c: number) {
      r.statusCode = c;
      return r;
    },
    json(o: any) {
      r.body = o;
      return r;
    },
    set(k: string, v: string) {
      r.headers[k] = v;
      return r;
    },
  };
  return r;
}

function call(method: string, url: string, opts: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const r = res();
    const originalJson = r.json.bind(r);
    r.json = (o: any) => {
      originalJson(o);
      resolve(r);
      return r;
    };
    router.handle(req(method, url, opts), r, (err: any) =>
      err ? reject(err) : resolve(r)
    );
  });
}

const USER_A = { id: 1, role: "user" };
const USER_B = { id: 2, role: "user" };

async function seedConversation(userId: number, title = "Seeded"): Promise<number> {
  const s = await store();
  const id = s.nextConvId++;
  s.conversations.push({
    id,
    userId,
    title,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

beforeEach(async () => {
  const s = await store();
  s.conversations.length = 0;
  s.messages.length = 0;
  s.nextConvId = 1;
  s.nextMsgId = 1;
  chatLimiter.reset();
  mockChatReply.mockReset();
  mockIsChatConfigured.mockReset();
  mockIsChatConfigured.mockReturnValue(false);
  vi.unstubAllEnvs();
  vi.stubEnv("AI_PROVIDER", "");
  vi.stubEnv("GEMINI_API_KEY", "");
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("auth", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const r = await call("POST", "/conversations", { body: {} });
    expect(r.statusCode).toBe(401);
  });

  it("rejects unauthenticated status checks with 401", async () => {
    const r = await call("GET", "/status");
    expect(r.statusCode).toBe(401);
  });
});

describe("conversations", () => {
  it("creates a conversation for the signed-in user", async () => {
    const r = await call("POST", "/conversations", {
      user: USER_A,
      body: { title: "My chat" },
    });
    expect(r.statusCode).toBe(201);
    expect(r.body.conversation.title).toBe("My chat");
    const s = await store();
    expect(s.conversations[0].userId).toBe(1);
  });

  it("lists only the requesting user's conversations", async () => {
    await seedConversation(1, "A's chat");
    const r = await call("GET", "/conversations", { user: USER_A });
    expect(r.statusCode).toBe(200);
    expect(r.body.conversations).toHaveLength(1);
  });

  it("user B cannot read user A's conversation (404, no leak)", async () => {
    const id = await seedConversation(1);
    const r = await call("GET", `/conversations/${id}`, { user: USER_B });
    expect(r.statusCode).toBe(404);
    expect(r.body.error).toBe("Conversation not found.");
  });

  it("owner can read their conversation with messages", async () => {
    const id = await seedConversation(1);
    const r = await call("GET", `/conversations/${id}`, { user: USER_A });
    expect(r.statusCode).toBe(200);
    expect(r.body.conversation.id).toBe(id);
    expect(r.body.messages).toEqual([]);
  });

  it("user B cannot delete user A's conversation", async () => {
    const id = await seedConversation(1);
    const r = await call("DELETE", `/conversations/${id}`, { user: USER_B });
    expect(r.statusCode).toBe(404);
    const s = await store();
    expect(s.conversations).toHaveLength(1);
  });

  it("owner can delete their conversation", async () => {
    const id = await seedConversation(1);
    const r = await call("DELETE", `/conversations/${id}`, { user: USER_A });
    expect(r.statusCode).toBe(200);
    const s = await store();
    expect(s.conversations).toHaveLength(0);
  });
});

describe("messages", () => {
  it("returns 503 with setup guidance when AI is not configured", async () => {
    mockIsChatConfigured.mockReturnValue(false);
    const id = await seedConversation(1);
    const r = await call("POST", `/conversations/${id}/messages`, {
      user: USER_A,
      body: { content: "Hello" },
    });
    expect(r.statusCode).toBe(503);
    expect(r.body.error).toBe("AI chat is not configured.");
    expect(r.body.hint).toContain("AI_SETUP.md");
    expect(mockChatReply).not.toHaveBeenCalled();
  });

  it("saves the user message, gets a reply, and auto-titles", async () => {
    mockIsChatConfigured.mockReturnValue(true);
    mockChatReply.mockResolvedValue("Here is some career advice.");
    const id = await seedConversation(1, "New chat");
    const r = await call("POST", `/conversations/${id}/messages`, {
      user: USER_A,
      body: { content: "How do I prepare for interviews?" },
    });
    expect(r.statusCode).toBe(201);
    expect(r.body.assistantMessage.content).toBe("Here is some career advice.");
    const s = await store();
    expect(s.messages).toHaveLength(2);
    expect(s.messages[0].role).toBe("user");
    expect(s.messages[1].role).toBe("assistant");
    expect(s.conversations[0].title).not.toBe("New chat");
  });

  it("rejects empty content with 400", async () => {
    mockIsChatConfigured.mockReturnValue(true);
    const id = await seedConversation(1);
    const r = await call("POST", `/conversations/${id}/messages`, {
      user: USER_A,
      body: { content: "   " },
    });
    expect(r.statusCode).toBe(400);
  });

  it("rejects oversized content with 400", async () => {
    mockIsChatConfigured.mockReturnValue(true);
    const id = await seedConversation(1);
    const r = await call("POST", `/conversations/${id}/messages`, {
      user: USER_A,
      body: { content: "x".repeat(4001) },
    });
    expect(r.statusCode).toBe(400);
  });

  it("user B cannot message in user A's conversation", async () => {
    mockIsChatConfigured.mockReturnValue(true);
    const id = await seedConversation(1);
    const r = await call("POST", `/conversations/${id}/messages`, {
      user: USER_B,
      body: { content: "hi" },
    });
    expect(r.statusCode).toBe(404);
    expect(mockChatReply).not.toHaveBeenCalled();
  });

  it("maps Gemini quota errors to 429 with a friendly message", async () => {
    mockIsChatConfigured.mockReturnValue(true);
    const { AIQuotaExceededError } = await import("../ai/errors.js");
    mockChatReply.mockRejectedValue(new AIQuotaExceededError());
    const id = await seedConversation(1);
    const r = await call("POST", `/conversations/${id}/messages`, {
      user: USER_A,
      body: { content: "hello" },
    });
    expect(r.statusCode).toBe(429);
    expect(r.body.error).toContain("AI is busy");
  });

  it("enforces 30 messages/hour per user", async () => {
    mockIsChatConfigured.mockReturnValue(true);
    mockChatReply.mockResolvedValue("ok");
    const id = await seedConversation(1);
    let last: any = null;
    for (let i = 0; i < 31; i++) {
      last = await call("POST", `/conversations/${id}/messages`, {
        user: USER_A,
        body: { content: `message ${i}` },
      });
    }
    expect(last.statusCode).toBe(429);
    expect(last.headers["Retry-After"]).toBeDefined();
  });
});

describe("GET /status", () => {
  it("exposes the ai block without leaking the key", async () => {
    const r = await call("GET", "/status", { user: USER_A });
    expect(r.statusCode).toBe(200);
    expect(r.body.provider).toBe("template");
    expect(r.body.configured).toBe(false);
    expect(r.body.model).toBeNull();
    expect(JSON.stringify(r.body)).not.toContain("AIza");
  });
});

describe("pure helpers", () => {
  it("ownsConversation gates on user id", () => {
    expect(ownsConversation({ userId: 1 } as any, 1)).toBe(true);
    expect(ownsConversation({ userId: 1 } as any, 2)).toBe(false);
    expect(ownsConversation(null, 1)).toBe(false);
    expect(ownsConversation(undefined, 1)).toBe(false);
  });

  it("validateMessageInput enforces shape and limits", () => {
    expect(validateMessageInput({ content: "hi" }).ok).toBe(true);
    expect(validateMessageInput({ content: "" }).ok).toBe(false);
    expect(validateMessageInput({}).ok).toBe(false);
    expect(validateMessageInput({ content: "x".repeat(4001) }).ok).toBe(false);
    expect(validateMessageInput({ content: "hi", language: "xx" }).ok).toBe(
      false
    );
    expect(
      validateMessageInput({ content: "hi", language: "ur" }).ok
    ).toBe(true);
  });

  it("validateConversationInput defaults the title", () => {
    expect(validateConversationInput({}).value?.title).toBe("New chat");
    expect(validateConversationInput({ title: "x".repeat(201) }).ok).toBe(false);
  });

  it("unconfiguredBody is honest and actionable", () => {
    const b = unconfiguredBody();
    expect(b.error).toContain("not configured");
    expect(b.hint).toContain("GEMINI_API_KEY");
  });
});
