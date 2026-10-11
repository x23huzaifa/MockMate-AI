/**
 * Protected dashboard. Shows the signed-in user, real interview stats
 * (computed from stored sessions — never fabricated), recent interviews,
 * and links into the Phase C flows. Phase F adds progress/history links
 * and the admin-panel link (visible only when user.role === "admin").
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api, statusLabel } from "../lib/api";
import {
  button,
  card,
  footerText,
  link,
  pageWrap,
  subtitle,
  title,
} from "./styles";

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "0.6rem 0",
  borderBottom: "1px solid #eef1f6",
  fontSize: "0.95rem",
};

const rowLabel: React.CSSProperties = { color: "#64748B" };
const rowValue: React.CSSProperties = { fontWeight: 600 };

interface InterviewSummary {
  id: number;
  status: string;
  totalQuestions: number;
  currentQuestionIndex: number;
  createdAt: string;
}

const interviewItem: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0.6rem 0",
  borderBottom: "1px solid #eef1f6",
  fontSize: "0.92rem",
};

const actionButton: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  textDecoration: "none",
  boxSizing: "border-box",
  width: "100%",
  marginTop: "0.75rem",
  padding: "0.7rem",
  fontSize: "1rem",
  fontWeight: 700,
  color: "#ffffff",
  background: "#4F7CFF",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontFamily: "inherit",
};

const secondaryButton: React.CSSProperties = {
  ...actionButton,
  background: "#ffffff",
  color: "#182033",
  border: "1px solid #cbd5e1",
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<InterviewSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api<{ interviews: InterviewSummary[] }>(
          "/api/v1/interviews"
        );
        if (!cancelled) setInterviews(data.interviews);
      } catch {
        if (!cancelled) setInterviews([]);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null; // ProtectedRoute guarantees a user; belt and braces.

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  const completedCount = interviews?.filter((i) => i.status === "completed").length ?? null;
  const recent = interviews?.slice(0, 5) ?? [];

  return (
    <div style={pageWrap}>
      <main style={{ ...card, maxWidth: 560 }}>
        <h1 style={title}>Dashboard</h1>
        <p style={subtitle}>Welcome, {user.name}.</p>

        <div style={{ ...row, borderTop: "1px solid #eef1f6" }}>
          <span style={rowLabel}>Email</span>
          <span style={rowValue}>{user.email}</span>
        </div>
        <div style={row}>
          <span style={rowLabel}>Interviews completed</span>
          <span style={rowValue}>
            {completedCount === null ? "…" : completedCount}
          </span>
        </div>
        <div style={row}>
          <span style={rowLabel}>CVs</span>
          <Link to="/cvs" style={link}>
            Manage →
          </Link>
        </div>
        <div style={row}>
          <span style={rowLabel}>Job profiles</span>
          <Link to="/jobs" style={link}>
            Manage →
          </Link>
        </div>
        <div style={row}>
          <span style={rowLabel}>Language settings</span>
          <Link to="/settings/languages" style={link}>
            Manage →
          </Link>
        </div>
        <div style={row}>
          <span style={rowLabel}>My progress</span>
          <Link to="/progress" style={link}>
            View →
          </Link>
        </div>
        <div style={row}>
          <span style={rowLabel}>Session history</span>
          <Link to="/history" style={link}>
            View →
          </Link>
        </div>
        {user.role === "admin" && (
          <div style={row}>
            <span style={rowLabel}>Admin panel</span>
            <Link to="/admin" style={link}>
              Open →
            </Link>
          </div>
        )}

        <Link to="/interview/setup" style={actionButton}>
          Start mock interview →
        </Link>

        {recent.length > 0 && (
          <>
            <h2 style={{ ...title, fontSize: "1.1rem", marginTop: "1.5rem" }}>
              Recent interviews
            </h2>
            {recent.map((iv) => (
              <div key={iv.id} style={interviewItem}>
                <span>
                  Interview #{iv.id}{" "}
                  <span style={{ color: "#64748B" }}>
                    · {statusLabel(iv.status)}
                  </span>
                </span>
                {iv.status === "completed" ||
                iv.status === "interrupted" ? (
                  <Link to={`/interview/${iv.id}/report`} style={link}>
                    Report →
                  </Link>
                ) : (
                  <Link to={`/interview/${iv.id}`} style={link}>
                    Continue →
                  </Link>
                )}
              </div>
            ))}
          </>
        )}

        <button
          type="button"
          style={{ ...button, ...secondaryButton, marginTop: "1.5rem" }}
          onClick={handleLogout}
        >
          Sign out
        </button>
        <p style={footerText}>
          <Link to="/" style={link}>
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
