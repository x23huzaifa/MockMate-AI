/**
 * Protected session history (/history).
 *
 * Lists the user's interview sessions with search (job-profile title or
 * session id), status filter, and interview-language filter.
 *
 * FILTERING CHOICE (documented): filtering happens client-side on the
 * fetched lists. The existing GET /api/v1/interviews already fetches the
 * user's sessions and filters in JS (see server/routes/interviews.ts), so a
 * server-side ?q= join would add a second query path for the same small
 * per-user dataset. Client-side keeps one code path and stays consistent.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, languageLabel, statusLabel } from "../lib/api";
import {
  card,
  errorBox,
  input,
  label,
  link,
  pageWrap,
  subtitle,
  title,
} from "./styles";

interface SessionSummary {
  id: number;
  jobProfileId: number | null;
  status: string;
  interviewLanguage: string;
  totalQuestions: number;
  currentQuestionIndex: number;
  completedAt: string | null;
  createdAt: string;
}

interface JobProfileSummary {
  id: number;
  title: string;
}

const filterRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.75rem",
  marginTop: "1rem",
};

const item: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.75rem 0",
  borderBottom: "1px solid #eef1f6",
  fontSize: "0.93rem",
};

const meta: React.CSSProperties = { color: "#64748B", fontSize: "0.85rem" };

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

export default function History() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [profiles, setProfiles] = useState<JobProfileSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [s, j] = await Promise.all([
          api<{ interviews: SessionSummary[] }>("/api/v1/interviews"),
          api<{ jobProfiles: JobProfileSummary[] }>("/api/v1/job-profiles"),
        ]);
        if (!cancelled) {
          setSessions(s.interviews);
          setProfiles(j.jobProfiles);
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const titleByProfileId = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of profiles) map.set(p.id, p.title);
    return map;
  }, [profiles]);

  const languages = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions ?? []) set.add(s.interviewLanguage);
    return [...set];
  }, [sessions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (sessions ?? []).filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (languageFilter && s.interviewLanguage !== languageFilter) return false;
      if (q) {
        const profileTitle =
          s.jobProfileId !== null
            ? (titleByProfileId.get(s.jobProfileId) ?? "")
            : "";
        const haystack =
          `${profileTitle} ${s.id} ${statusLabel(s.status)}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [sessions, query, statusFilter, languageFilter, titleByProfileId]);

  return (
    <div style={pageWrap}>
      <main style={{ ...card, maxWidth: 680 }}>
        <h1 style={title}>Session history</h1>
        <p style={subtitle}>
          Every interview you started — search, filter, and jump back into
          reports or in-progress sessions.
        </p>

        {error && <div style={errorBox}>{error}</div>}

        <label style={label} htmlFor="history-search">
          Search (job title or session #)
        </label>
        <input
          id="history-search"
          style={input}
          type="search"
          placeholder="e.g. frontend developer"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div style={filterRow}>
          <div>
            <label style={label} htmlFor="history-status">
              Status
            </label>
            <select
              id="history-status"
              style={input}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="completed">Completed</option>
              <option value="awaiting_answer">In progress</option>
              <option value="paused">Paused</option>
              <option value="interrupted">Interrupted</option>
              <option value="failed">Failed</option>
              <option value="created">Not started</option>
            </select>
          </div>
          <div>
            <label style={label} htmlFor="history-language">
              Language
            </label>
            <select
              id="history-language"
              style={input}
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
            >
              <option value="">All languages</option>
              {languages.map((l) => (
                <option key={l} value={l}>
                  {languageLabel(l)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: "1.25rem" }}>
          {sessions === null && !error && <p style={subtitle}>Loading…</p>}

          {sessions !== null && sessions.length === 0 && (
            <p style={subtitle}>
              No interviews yet.{" "}
              <Link to="/interview/setup" style={link}>
                Start your first mock interview →
              </Link>
            </p>
          )}

          {sessions !== null && sessions.length > 0 && filtered.length === 0 && (
            <p style={subtitle}>No sessions match these filters.</p>
          )}

          {filtered.map((s) => {
            const profileTitle =
              s.jobProfileId !== null
                ? titleByProfileId.get(s.jobProfileId)
                : null;
            const done =
              s.status === "completed" || s.status === "interrupted";
            return (
              <div key={s.id} style={item}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {profileTitle ?? `Interview #${s.id}`}
                    {profileTitle && (
                      <span style={meta}> · #{s.id}</span>
                    )}
                  </div>
                  <div style={meta}>
                    {statusLabel(s.status)} ·{" "}
                    {languageLabel(s.interviewLanguage)} ·{" "}
                    {formatDate(s.completedAt ?? s.createdAt)}
                  </div>
                </div>
                {done ? (
                  <Link to={`/interview/${s.id}/report`} style={link}>
                    Report →
                  </Link>
                ) : (
                  <Link to={`/interview/${s.id}`} style={link}>
                    Continue →
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        <p style={{ marginTop: "1.75rem", fontSize: "0.9rem" }}>
          <Link to="/dashboard" style={link}>
            ← Dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}
