/**
 * AI career chat page (protected): conversations with the Gemini-powered
 * career coach, or an honest demo-mode notice when no AI provider is
 * configured.
 *
 * The banner reads the `ai` block from /api/v1/health and NEVER labels
 * template output as Gemini: "Gemini-powered (model X)" vs
 * "Demo mode — AI not configured. Interviews use built-in templates."
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  button,
  buttonDisabled,
  card,
  errorBox,
  input,
  label,
  link,
  pageWrap,
  subtitle,
  title,
} from "./styles";

interface AiBlock {
  configured: boolean;
  provider: "gemini" | "template";
  model: string | null;
}

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatMsg {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ur", label: "Urdu" },
  { value: "roman-ur", label: "Roman Urdu" },
];

const layout: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "260px 1fr",
  gap: "1rem",
  alignItems: "start",
};

const convoItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
  width: "100%",
  textAlign: "left",
  padding: "0.55rem 0.7rem",
  borderRadius: "0.5rem",
  border: "1px solid transparent",
  background: "transparent",
  cursor: "pointer",
  fontSize: "0.9rem",
};

const convoActive: CSSProperties = {
  ...convoItem,
  background: "#eef2ff",
  borderColor: "#c7d2fe",
};

const deleteBtn: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#b91c1c",
  cursor: "pointer",
  fontSize: "0.85rem",
  padding: "0.15rem 0.3rem",
};

const bannerBase: CSSProperties = {
  padding: "0.7rem 1rem",
  borderRadius: "0.6rem",
  fontSize: "0.9rem",
  marginBottom: "1rem",
};

const bannerGemini: CSSProperties = {
  ...bannerBase,
  background: "#ecfdf5",
  border: "1px solid #a7f3d0",
  color: "#065f46",
};

const bannerDemo: CSSProperties = {
  ...bannerBase,
  background: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#92400e",
};

const msgList: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  maxHeight: "52vh",
  overflowY: "auto",
  padding: "0.25rem",
  marginBottom: "1rem",
};

const msgBase: CSSProperties = {
  padding: "0.7rem 0.9rem",
  borderRadius: "0.7rem",
  fontSize: "0.93rem",
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const msgUser: CSSProperties = {
  ...msgBase,
  alignSelf: "flex-end",
  maxWidth: "85%",
  background: "#eef2ff",
  border: "1px solid #c7d2fe",
};

const msgAssistant: CSSProperties = {
  ...msgBase,
  alignSelf: "flex-start",
  maxWidth: "92%",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const copyBtn: CSSProperties = {
  marginTop: "0.4rem",
  border: "1px solid #e2e8f0",
  background: "#fff",
  borderRadius: "0.4rem",
  fontSize: "0.75rem",
  padding: "0.2rem 0.55rem",
  cursor: "pointer",
  color: "#475569",
};

const composer: CSSProperties = {
  display: "flex",
  gap: "0.6rem",
  alignItems: "flex-end",
};

const textareaStyle: CSSProperties = {
  ...input,
  flex: 1,
  minHeight: "2.8rem",
  resize: "vertical",
  fontFamily: "inherit",
};

export default function Chat() {
  const [ai, setAi] = useState<AiBlock | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [language, setLanguage] = useState("en");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadHealth = useCallback(async () => {
    try {
      const h = await api<{ ai: AiBlock }>("/api/v1/health");
      setAi(h.ai);
    } catch {
      setAi(null);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    const data = await api<{ conversations: Conversation[] }>(
      "/api/v1/chat/conversations?limit=50"
    );
    setConversations(data.conversations);
    return data.conversations;
  }, []);

  const loadMessages = useCallback(async (id: number) => {
    const data = await api<{ messages: ChatMsg[] }>(
      `/api/v1/chat/conversations/${id}`
    );
    setMessages(data.messages);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadHealth();
        const convos = await loadConversations();
        if (convos.length > 0) {
          setActiveId(convos[0].id);
          await loadMessages(convos[0].id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load chat.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadHealth, loadConversations, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function selectConversation(id: number) {
    setActiveId(id);
    setError(null);
    try {
      await loadMessages(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages.");
    }
  }

  async function newConversation() {
    setError(null);
    try {
      const data = await api<{ conversation: Conversation }>(
        "/api/v1/chat/conversations",
        { method: "POST", body: JSON.stringify({}) }
      );
      const convos = await loadConversations();
      setConversations(convos);
      setActiveId(data.conversation.id);
      setMessages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start a chat.");
    }
  }

  async function deleteConversation(id: number) {
    if (!window.confirm("Delete this conversation and all its messages?")) {
      return;
    }
    setError(null);
    try {
      await api(`/api/v1/chat/conversations/${id}`, { method: "DELETE" });
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      if (activeId === id) {
        setActiveId(remaining.length > 0 ? remaining[0].id : null);
        setMessages([]);
        if (remaining.length > 0) await loadMessages(remaining[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the chat.");
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setError(null);

    let convId = activeId;
    try {
      if (convId === null) {
        const data = await api<{ conversation: Conversation }>(
          "/api/v1/chat/conversations",
          { method: "POST", body: JSON.stringify({}) }
        );
        convId = data.conversation.id;
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveId(convId);
        setMessages([]);
      }
      setSending(true);
      const optimistic: ChatMsg = {
        id: -Date.now(),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setDraft("");
      const data = await api<{ assistantMessage: ChatMsg | null }>(
        `/api/v1/chat/conversations/${convId}/messages`,
        { method: "POST", body: JSON.stringify({ content, language }) }
      );
      setMessages((prev) => [
        ...prev.filter((m) => m.id > 0),
        ...(data.assistantMessage ? [data.assistantMessage] : []),
      ]);
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send.");
      // Roll back the optimistic message on failure.
      setMessages((prev) => prev.filter((m) => m.id > 0));
      setDraft(content);
    } finally {
      setSending(false);
    }
  }

  async function copyResponse(id: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API unavailable (permissions/iframe) — select manually.
      setError("Copy failed — select the text manually.");
      return;
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
  }

  return (
    <div style={pageWrap}>
      <h1 style={title}>AI Career Chat</h1>
      <p style={subtitle}>
        Ask about interviews, CVs, careers, or English —{" "}
        <Link to="/dashboard" style={link}>
          back to dashboard
        </Link>
      </p>

      {ai && ai.configured && (
        <div style={bannerGemini} role="status">
          <strong>Gemini-powered</strong>
          {ai.model ? ` (model ${ai.model})` : ""} — replies come from Google
          Gemini. Still an AI estimate, not a recruiter.
        </div>
      )}
      {ai && !ai.configured && (
        <div style={bannerDemo} role="status">
          <strong>Demo mode — AI not configured.</strong> Chat needs
          AI_PROVIDER=gemini and GEMINI_API_KEY (see AI_SETUP.md). Interviews
          use the built-in templates.
        </div>
      )}

      {error && (
        <div style={errorBox} role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <div style={layout}>
          <div style={card}>
            <button type="button" style={button} onClick={newConversation}>
              + New chat
            </button>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                marginTop: "0.75rem",
              }}
            >
              {conversations.length === 0 && (
                <p style={{ fontSize: "0.88rem", color: "#64748b" }}>
                  No conversations yet.
                </p>
              )}
              {conversations.map((c) => (
                <div
                  key={c.id}
                  style={c.id === activeId ? convoActive : convoItem}
                  onClick={() => selectConversation(c.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") selectConversation(c.id);
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.title}
                  </span>
                  <button
                    type="button"
                    style={deleteBtn}
                    title="Delete conversation"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(c.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={card}>
            <div style={msgList} aria-live="polite">
              {messages.length === 0 && !sending && (
                <p style={{ color: "#64748b", fontSize: "0.92rem" }}>
                  {ai && !ai.configured
                    ? "Chat is unavailable in demo mode — configure Gemini to start chatting."
                    : "Start a conversation: ask about interview prep, your CV, or career plans."}
                </p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={m.role === "user" ? msgUser : msgAssistant}
                >
                  <div>{m.content}</div>
                  {m.role === "assistant" && m.id > 0 && (
                    <button
                      type="button"
                      style={copyBtn}
                      onClick={() => copyResponse(m.id, m.content)}
                    >
                      {copiedId === m.id ? "Copied ✓" : "Copy response"}
                    </button>
                  )}
                </div>
              ))}
              {sending && (
                <div style={msgAssistant}>
                  <em>Thinking…</em>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send}>
              <label style={label} htmlFor="chat-language">
                Reply language
              </label>
              <select
                id="chat-language"
                style={{ ...input, marginBottom: "0.6rem", maxWidth: "16rem" }}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
              <div style={composer}>
                <textarea
                  style={textareaStyle}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={
                    ai && !ai.configured
                      ? "AI not configured…"
                      : "Ask about interviews, CVs, careers…"
                  }
                  disabled={sending || (ai !== null && !ai.configured)}
                  aria-label="Chat message"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(e as unknown as FormEvent);
                    }
                  }}
                />
                <button
                  type="submit"
                  style={sending || !draft.trim() ? buttonDisabled : button}
                  disabled={sending || !draft.trim()}
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
