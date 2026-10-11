/**
 * Admin panel (/admin) — rendered only for role === "admin" (see AdminRoute
 * in App.tsx; non-admins get a "Not authorized" page, never a redirect).
 *
 * Tabs: Users (role management), Sessions (metadata only — the privacy rule
 * forbids showing transcripts or CV contents here), Contact (review/archive),
 * Audit log. Every mutation is audit-logged server-side.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api, languageLabel, statusLabel } from "../lib/api";
import {
  card,
  errorBox,
  input,
  link,
  pageWrap,
  successBox,
  title,
} from "./styles";

type Tab = "users" | "sessions" | "contact" | "audit";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface AdminSession {
  id: number;
  userId: number;
  userEmail: string;
  status: string;
  interviewLanguage: string;
  feedbackLanguage: string;
  totalQuestions: number;
  answered: number;
  avgOverallScore: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface ContactMessage {
  id: number;
  name: string;
  email: string;
  message: string;
  status: string;
  createdAt: string;
}

interface AuditLog {
  id: number;
  actorUserId: number | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const tabBar: React.CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  margin: "1.25rem 0",
  flexWrap: "wrap",
};

const tabButton = (active: boolean): React.CSSProperties => ({
  padding: "0.5rem 1rem",
  borderRadius: 8,
  fontSize: "0.9rem",
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  background: active ? "#4F7CFF" : "#ffffff",
  color: active ? "#ffffff" : "#182033",
  border: active ? "none" : "1px solid #cbd5e1",
});

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.88rem",
  marginTop: "0.75rem",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "0.5rem",
  borderBottom: "2px solid #eef1f6",
  color: "#64748B",
  fontSize: "0.78rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const td: React.CSSProperties = {
  padding: "0.55rem 0.5rem",
  borderBottom: "1px solid #eef1f6",
  verticalAlign: "top",
};

const smallButton: React.CSSProperties = {
  padding: "0.35rem 0.7rem",
  fontSize: "0.82rem",
  fontWeight: 700,
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#182033",
  cursor: "pointer",
  fontFamily: "inherit",
  marginRight: "0.4rem",
};

const primarySmall: React.CSSProperties = {
  ...smallButton,
  background: "#4F7CFF",
  border: "none",
  color: "#ffffff",
};

const pager: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  marginTop: "1rem",
  fontSize: "0.9rem",
  color: "#64748B",
};

function Pager({
  page,
  total,
  limit,
  onPage,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div style={pager}>
      <button
        type="button"
        style={smallButton}
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        ← Prev
      </button>
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <button
        type="button"
        style={smallButton}
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next →
      </button>
    </div>
  );
}

function UsersTab() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [roles, setRoles] = useState<Record<number, string>>({});
  const limit = 20;

  const load = useCallback(async (p: number) => {
    setError(null);
    try {
      const data = await api<{
        users: AdminUser[];
        page: number;
        limit: number;
        total: number;
      }>(`/api/v1/admin/users?page=${p}&limit=${limit}`);
      setUsers(data.users);
      setPage(data.page);
      setTotal(data.total);
      const initial: Record<number, string> = {};
      for (const u of data.users) initial[u.id] = u.role;
      setRoles(initial);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  async function saveRole(u: AdminUser) {
    const newRole = roles[u.id];
    if (!newRole || newRole === u.role) return;
    setError(null);
    setNotice(null);
    if (
      newRole === "user" &&
      !window.confirm(`Demote ${u.email} from admin to user?`)
    ) {
      return;
    }
    try {
      const data = await api<{ user: AdminUser }>(
        `/api/v1/admin/users/${u.id}/role`,
        { method: "PATCH", body: JSON.stringify({ role: newRole }) }
      );
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, role: data.user.role } : x))
      );
      setNotice(`Role updated for ${u.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role change failed.");
    }
  }

  return (
    <div>
      {error && <div style={errorBox}>{error}</div>}
      {notice && <div style={successBox}>{notice}</div>}
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Name</th>
            <th style={th}>Email</th>
            <th style={th}>Role</th>
            <th style={th}>Joined</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td style={td}>{u.name}</td>
              <td style={td}>
                {u.email}
                {user && u.id === user.id && (
                  <span style={{ color: "#64748B" }}> (you)</span>
                )}
              </td>
              <td style={td}>
                <select
                  style={{ ...input, padding: "0.3rem 0.5rem", fontSize: "0.85rem" }}
                  value={roles[u.id] ?? u.role}
                  onChange={(e) =>
                    setRoles((prev) => ({ ...prev, [u.id]: e.target.value }))
                  }
                  aria-label={`Role for ${u.email}`}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td style={td}>{new Date(u.createdAt).toLocaleDateString()}</td>
              <td style={td}>
                <button
                  type="button"
                  style={primarySmall}
                  disabled={(roles[u.id] ?? u.role) === u.role}
                  onClick={() => void saveRole(u)}
                >
                  Save
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager page={page} total={total} limit={limit} onPage={(p) => void load(p)} />
    </div>
  );
}

function SessionsTab() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const limit = 20;

  // Filters are read via ref so typing in the user-ID box doesn't fire a
  // request per keystroke — they apply on mount and on "Apply filters".
  const filtersRef = useRef({ statusFilter: "", userIdFilter: "" });
  filtersRef.current = { statusFilter, userIdFilter };

  const load = useCallback(async (p: number) => {
    setError(null);
    try {
      const { statusFilter: sf, userIdFilter: uf } = filtersRef.current;
      const params = new URLSearchParams({
        page: String(p),
        limit: String(limit),
      });
      if (sf) params.set("status", sf);
      if (uf.trim()) params.set("userId", uf.trim());
      const data = await api<{
        sessions: AdminSession[];
        page: number;
        limit: number;
        total: number;
      }>(`/api/v1/admin/sessions?${params.toString()}`);
      setSessions(data.sessions);
      setPage(data.page);
      setTotal(data.total);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load sessions."
      );
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <div>
      <p style={{ fontSize: "0.85rem", color: "#64748B", margin: "0 0 0.5rem" }}>
        Metadata only — transcripts and CV contents are never shown here
        (privacy rule).
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <select
          style={{ ...input, width: "auto" }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="completed">completed</option>
          <option value="awaiting_answer">awaiting_answer</option>
          <option value="paused">paused</option>
          <option value="interrupted">interrupted</option>
          <option value="failed">failed</option>
          <option value="created">created</option>
        </select>
        <input
          style={{ ...input, width: "auto" }}
          placeholder="User ID"
          value={userIdFilter}
          onChange={(e) => setUserIdFilter(e.target.value)}
          inputMode="numeric"
          aria-label="Filter by user ID"
        />
        <button
          type="button"
          style={primarySmall}
          onClick={() => void load(1)}
        >
          Apply filters
        </button>
      </div>
      {error && <div style={errorBox}>{error}</div>}
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>ID</th>
            <th style={th}>User</th>
            <th style={th}>Status</th>
            <th style={th}>Language</th>
            <th style={th}>Answered</th>
            <th style={th}>Avg score</th>
            <th style={th}>Created</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td style={td}>#{s.id}</td>
              <td style={td}>
                {s.userEmail}
                <div style={{ color: "#64748B", fontSize: "0.78rem" }}>
                  id {s.userId}
                </div>
              </td>
              <td style={td}>{statusLabel(s.status)}</td>
              <td style={td}>{languageLabel(s.interviewLanguage)}</td>
              <td style={td}>
                {s.answered}/{s.totalQuestions}
              </td>
              <td style={td}>
                {s.avgOverallScore === null ? "—" : s.avgOverallScore.toFixed(2)}
              </td>
              <td style={td}>{new Date(s.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sessions.length === 0 && !error && (
        <p style={{ color: "#64748B", fontSize: "0.9rem" }}>No sessions found.</p>
      )}
      <Pager page={page} total={total} limit={limit} onPage={(p) => void load(p)} />
    </div>
  );
}

function ContactTab() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const limit = 20;

  const load = useCallback(
    async (p: number) => {
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(p),
          limit: String(limit),
        });
        if (statusFilter) params.set("status", statusFilter);
        const data = await api<{
          messages: ContactMessage[];
          page: number;
          limit: number;
          total: number;
        }>(`/api/v1/admin/contact?${params.toString()}`);
        setMessages(data.messages);
        setPage(data.page);
        setTotal(data.total);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load messages."
        );
      }
    },
    [statusFilter]
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  async function setStatus(m: ContactMessage, status: string) {
    setError(null);
    try {
      const data = await api<{ message: ContactMessage }>(
        `/api/v1/admin/contact/${m.id}`,
        { method: "PATCH", body: JSON.stringify({ status }) }
      );
      setMessages((prev) =>
        prev.map((x) => (x.id === m.id ? data.message : x))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  return (
    <div>
      <select
        style={{ ...input, width: "auto" }}
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        aria-label="Filter by status"
      >
        <option value="">All statuses</option>
        <option value="new">new</option>
        <option value="reviewed">reviewed</option>
        <option value="archived">archived</option>
      </select>
      {error && <div style={errorBox}>{error}</div>}
      {messages.map((m) => (
        <div
          key={m.id}
          style={{
            border: "1px solid #eef1f6",
            borderRadius: 12,
            padding: "0.9rem 1rem",
            marginTop: "0.75rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <strong>
              {m.name} <span style={{ color: "#64748B" }}>· {m.email}</span>
            </strong>
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color:
                  m.status === "new"
                    ? "#4F7CFF"
                    : m.status === "reviewed"
                      ? "#047857"
                      : "#64748B",
              }}
            >
              {m.status}
            </span>
          </div>
          <p style={{ fontSize: "0.92rem", margin: "0.5rem 0" }}>{m.message}</p>
          <div style={{ color: "#64748B", fontSize: "0.8rem" }}>
            {new Date(m.createdAt).toLocaleString()}
          </div>
          <div style={{ marginTop: "0.5rem" }}>
            {m.status !== "reviewed" && (
              <button
                type="button"
                style={smallButton}
                onClick={() => void setStatus(m, "reviewed")}
              >
                Mark reviewed
              </button>
            )}
            {m.status !== "archived" && (
              <button
                type="button"
                style={smallButton}
                onClick={() => void setStatus(m, "archived")}
              >
                Archive
              </button>
            )}
            {m.status !== "new" && (
              <button
                type="button"
                style={smallButton}
                onClick={() => void setStatus(m, "new")}
              >
                Reopen
              </button>
            )}
          </div>
        </div>
      ))}
      {messages.length === 0 && !error && (
        <p style={{ color: "#64748B", fontSize: "0.9rem" }}>No messages.</p>
      )}
      <Pager page={page} total={total} limit={limit} onPage={(p) => void load(p)} />
    </div>
  );
}

function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const limit = 20;

  // Read via ref so typing doesn't fire a request per keystroke — the
  // filter applies on mount and on "Apply".
  const filterRef = useRef("");
  filterRef.current = actionFilter;

  const load = useCallback(async (p: number) => {
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(limit),
      });
      const af = filterRef.current.trim();
      if (af) params.set("action", af);
      const data = await api<{
        logs: AuditLog[];
        page: number;
        limit: number;
        total: number;
      }>(`/api/v1/admin/audit?${params.toString()}`);
      setLogs(data.logs);
      setPage(data.page);
      setTotal(data.total);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load audit log."
      );
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <div>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <input
          style={{ ...input, width: "auto", flex: 1 }}
          placeholder="Filter by action, e.g. admin.user.role_changed"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          aria-label="Filter by action"
        />
        <button type="button" style={primarySmall} onClick={() => void load(1)}>
          Apply
        </button>
      </div>
      {error && <div style={errorBox}>{error}</div>}
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>When</th>
            <th style={th}>Actor</th>
            <th style={th}>Action</th>
            <th style={th}>Target</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td style={td}>{new Date(l.createdAt).toLocaleString()}</td>
              <td style={td}>
                {l.actorUserId === null ? "system" : `user #${l.actorUserId}`}
              </td>
              <td style={{ ...td, fontFamily: "monospace", fontSize: "0.82rem" }}>
                {l.action}
              </td>
              <td style={td}>
                {l.targetType ?? "—"}
                {l.targetId ? ` #${l.targetId}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {logs.length === 0 && !error && (
        <p style={{ color: "#64748B", fontSize: "0.9rem" }}>No audit entries.</p>
      )}
      <Pager page={page} total={total} limit={limit} onPage={(p) => void load(p)} />
    </div>
  );
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "users", label: "Users" },
  { id: "sessions", label: "Sessions" },
  { id: "contact", label: "Contact" },
  { id: "audit", label: "Audit log" },
];

export default function Admin() {
  const [tab, setTab] = useState<Tab>("users");

  return (
    <div style={pageWrap}>
      <main style={{ ...card, maxWidth: 860 }}>
        <h1 style={title}>Admin panel</h1>
        <div style={tabBar} role="tablist" aria-label="Admin sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              style={tabButton(tab === t.id)}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "users" && <UsersTab />}
        {tab === "sessions" && <SessionsTab />}
        {tab === "contact" && <ContactTab />}
        {tab === "audit" && <AuditTab />}

        <p style={{ marginTop: "1.75rem", fontSize: "0.9rem" }}>
          <Link to="/dashboard" style={link}>
            ← Dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}

/** Shown by AdminRoute in App.tsx when a signed-in non-admin visits /admin. */
export function NotAuthorized() {
  return (
    <div style={pageWrap}>
      <main style={{ ...card, maxWidth: 440, textAlign: "center" }}>
        <h1 style={title}>Not authorized</h1>
        <p style={{ color: "#64748B" }}>
          This area is for administrators only.
        </p>
        <p>
          <Link to="/dashboard" style={link}>
            ← Back to dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}
