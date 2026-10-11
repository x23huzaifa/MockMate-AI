/**
 * Interview report page (/interview/:id/report, protected).
 *
 * Every number on this page is computed server-side from stored rows
 * (GET /api/v1/interviews/:id/report) — nothing is fabricated. Dimension
 * bars show the mean of each rubric dimension across answered questions.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, statusLabel } from "../lib/api";
import {
  card,
  errorBox,
  footerText,
  link,
  pageWrap,
  subtitle,
  title,
} from "./styles";

interface DimensionMeans {
  relevance: number | null;
  depth: number | null;
  clarity: number | null;
  structure: number | null;
}

interface Summary {
  answered: number;
  total: number;
  overallMean: number | null;
  dimensionMeans: DimensionMeans;
}

interface ReportQuestion {
  orderIndex: number;
  category: string;
  questionText: string;
  answerText: string | null;
  scores: { relevance: number; depth: number; clarity: number; structure: number } | null;
  overallScore: string | number | null;
  feedbackText: string | null;
  strengths: string[];
  improvements: string[];
}

interface Report {
  session: {
    id: number;
    status: string;
    totalQuestions: number;
    feedbackLanguage: string;
  };
  summary: Summary;
  questions: ReportQuestion[];
  methodNote: string;
}

const DIMENSION_META: { key: keyof DimensionMeans; label: string; color: string }[] = [
  { key: "relevance", label: "Relevance", color: "#4F7CFF" },
  { key: "depth", label: "Depth", color: "#8B5CF6" },
  { key: "clarity", label: "Clarity", color: "#10B981" },
  { key: "structure", label: "Structure", color: "#F59E0B" },
];

function Bar({ value, color }: { value: number | null; color: string }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <div
      style={{
        height: 10,
        borderRadius: 999,
        background: "#eef1f6",
        overflow: "hidden",
        flex: 1,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: value === null ? "#cbd5e1" : color,
          borderRadius: 999,
        }}
      />
    </div>
  );
}

const questionCard: React.CSSProperties = {
  border: "1px solid #e6eaf2",
  borderRadius: 12,
  padding: "1.1rem 1.2rem",
  marginBottom: "1rem",
  background: "#ffffff",
};

const chip: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.75rem",
  fontWeight: 700,
  color: "#4F7CFF",
  background: "#eef2ff",
  borderRadius: 999,
  padding: "0.15rem 0.65rem",
  marginRight: "0.5rem",
};

export default function InterviewReport() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<Report>(`/api/v1/interviews/${id}/report`);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load report.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={pageWrap}>
      <main style={{ ...card, maxWidth: 720 }}>
        <h1 style={title}>Interview report</h1>

        {loading && <p style={subtitle}>Loading…</p>}
        {error && <div style={errorBox}>{error}</div>}

        {!loading && report && (
          <>
            <p style={subtitle}>
              Status: <strong>{statusLabel(report.session.status)}</strong>
              {" · "}{report.summary.answered} of {report.summary.total}{" "}
              questions answered
            </p>

            <div
              style={{
                textAlign: "center",
                padding: "1.5rem",
                borderRadius: 12,
                background: "#F7F8FC",
                marginBottom: "1.5rem",
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "#64748B" }}>
                Overall score
              </div>
              <div style={{ fontSize: "2.75rem", fontWeight: 800, color: "#182033" }}>
                {report.summary.overallMean === null
                  ? "—"
                  : report.summary.overallMean.toFixed(2)}
                <span style={{ fontSize: "1.25rem", color: "#64748B" }}> / 5</span>
              </div>
              {report.summary.overallMean === null && (
                <div style={{ fontSize: "0.9rem", color: "#64748B" }}>
                  No answers yet — scores appear after you answer questions.
                </div>
              )}
            </div>

            <h2 style={{ ...title, fontSize: "1.15rem" }}>Dimension averages</h2>
            {DIMENSION_META.map((d) => {
              const value = report.summary.dimensionMeans[d.key];
              return (
                <div
                  key={d.key}
                  style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.6rem" }}
                >
                  <span style={{ width: 90, fontSize: "0.9rem", fontWeight: 600 }}>
                    {d.label}
                  </span>
                  <Bar value={value} color={d.color} />
                  <span style={{ width: 44, textAlign: "right", fontSize: "0.9rem", fontWeight: 700 }}>
                    {value === null ? "—" : value.toFixed(2)}
                  </span>
                </div>
              );
            })}

            <h2 style={{ ...title, fontSize: "1.15rem", marginTop: "1.75rem" }}>
              Per-question breakdown
            </h2>
            {report.questions.map((q) => (
              <div key={q.orderIndex} style={questionCard}>
                <div style={{ marginBottom: "0.4rem" }}>
                  <span style={chip}>Q{q.orderIndex + 1}</span>
                  <span style={chip}>{q.category}</span>
                  {q.overallScore !== null && (
                    <strong style={{ float: "right" }}>
                      {Number(q.overallScore).toFixed(2)} / 5
                    </strong>
                  )}
                </div>
                <p style={{ fontWeight: 600, margin: "0.4rem 0" }}>
                  {q.questionText}
                </p>
                {q.answerText === null ? (
                  <p style={{ ...subtitle, margin: 0, fontStyle: "italic" }}>
                    Not answered.
                  </p>
                ) : (
                  <>
                    <p style={{ fontSize: "0.92rem", color: "#334155", whiteSpace: "pre-wrap" }}>
                      {q.answerText}
                    </p>
                    {q.feedbackText && (
                      <p
                        dir={report.session.feedbackLanguage === "ur" ? "rtl" : "ltr"}
                        lang={report.session.feedbackLanguage === "ur" ? "ur" : undefined}
                        style={{
                          fontSize: "0.92rem",
                          background: "#F7F8FC",
                          borderRadius: 8,
                          padding: "0.7rem 0.9rem",
                          fontFamily:
                            report.session.feedbackLanguage === "ur"
                              ? "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',system-ui,sans-serif"
                              : undefined,
                          lineHeight:
                            report.session.feedbackLanguage === "ur" ? 2 : undefined,
                        }}
                      >
                        {q.feedbackText}
                      </p>
                    )}
                    {q.strengths.length > 0 && (
                      <p
                        dir={report.session.feedbackLanguage === "ur" ? "rtl" : "ltr"}
                        style={{ fontSize: "0.88rem", margin: "0.4rem 0" }}
                      >
                        <strong style={{ color: "#047857" }}>Strengths: </strong>
                        {q.strengths.join(" · ")}
                      </p>
                    )}
                    {q.improvements.length > 0 && (
                      <p
                        dir={report.session.feedbackLanguage === "ur" ? "rtl" : "ltr"}
                        style={{ fontSize: "0.88rem", margin: "0.4rem 0" }}
                      >
                        <strong style={{ color: "#b45309" }}>Improve: </strong>
                        {q.improvements.join(" · ")}
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}

            <p style={{ ...subtitle, fontSize: "0.85rem", fontStyle: "italic" }}>
              {report.methodNote}
            </p>
          </>
        )}

        <p style={footerText}>
          <Link to="/dashboard" style={link}>← Back to dashboard</Link>
        </p>
      </main>
    </div>
  );
}
