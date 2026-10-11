/**
 * Protected progress page (/progress).
 *
 * Every number comes from GET /api/v1/progress/overview, which aggregates
 * the user's own stored interview rows — nothing is fabricated. Missing data
 * is null and renders as "—", never 0. Charts are hand-rolled SVG/CSS —
 * no chart library. Empty history gets an honest empty state, not zeros.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, languageLabel } from "../lib/api";
import {
  card,
  errorBox,
  link,
  pageWrap,
  subtitle,
  title,
} from "./styles";

interface DimensionAverages {
  relevance: number | null;
  depth: number | null;
  clarity: number | null;
  structure: number | null;
}

interface TrendPoint {
  sessionId: number;
  completedAt: string | null;
  overallScore: number;
}

interface Overview {
  totalSessions: number;
  completedSessions: number;
  inProgressSessions: number;
  avgOverallScore: number | null;
  bestScore: number | null;
  dimensionAverages: DimensionAverages;
  scoreTrend: TrendPoint[];
  byLanguage: Array<{ language: string; count: number }>;
  byCategory: Array<{ category: string; avgScore: number }>;
}

const statGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "0.75rem",
  margin: "1.25rem 0",
};

const statCard: React.CSSProperties = {
  background: "#F7F8FC",
  borderRadius: 12,
  padding: "0.9rem 1rem",
};

const statValue: React.CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 800,
  color: "#182033",
};

const statLabel: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "#64748B",
  marginTop: "0.2rem",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "1.05rem",
  fontWeight: 700,
  margin: "1.75rem 0 0.75rem",
};

const barRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "110px 1fr 44px",
  alignItems: "center",
  gap: "0.6rem",
  margin: "0.5rem 0",
  fontSize: "0.9rem",
};

const barTrack: React.CSSProperties = {
  height: 10,
  borderRadius: 999,
  background: "#eef1f6",
  overflow: "hidden",
};

const barFill: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, #4F7CFF, #8B5CF6)",
};

function fmt(score: number | null): string {
  return score === null ? "—" : score.toFixed(2);
}

const DIMENSIONS: Array<{ key: keyof DimensionAverages; label: string }> = [
  { key: "relevance", label: "Relevance" },
  { key: "depth", label: "Depth" },
  { key: "clarity", label: "Clarity" },
  { key: "structure", label: "Structure" },
];

function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) return null;
  const W = 520;
  const H = 180;
  const PAD = 28;
  const n = points.length;
  const x = (i: number) =>
    n === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (n - 1);
  // Scores are 1–5; map 1 → bottom, 5 → top.
  const y = (score: number) =>
    H - PAD - ((score - 1) / 4) * (H - 2 * PAD);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.overallScore).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label="Score trend across completed interviews"
    >
      {[1, 2, 3, 4, 5].map((s) => (
        <g key={s}>
          <line
            x1={PAD}
            x2={W - PAD}
            y1={y(s)}
            y2={y(s)}
            stroke="#eef1f6"
            strokeWidth={1}
          />
          <text
            x={PAD - 6}
            y={y(s) + 4}
            textAnchor="end"
            fontSize={10}
            fill="#94a3b8"
          >
            {s}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="#4F7CFF" strokeWidth={2.5} />
      {points.map((p, i) => (
        <g key={p.sessionId}>
          <circle
            cx={x(i)}
            cy={y(p.overallScore)}
            r={4}
            fill="#4F7CFF"
            stroke="#ffffff"
            strokeWidth={2}
          />
          <text
            x={x(i)}
            y={y(p.overallScore) - 10}
            textAnchor="middle"
            fontSize={10}
            fill="#182033"
            fontWeight={700}
          >
            {p.overallScore.toFixed(2)}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function Progress() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api<{ overview: Overview }>(
          "/api/v1/progress/overview"
        );
        if (!cancelled) setOverview(data.overview);
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

  return (
    <div style={pageWrap}>
      <main style={{ ...card, maxWidth: 680 }}>
        <h1 style={title}>My progress</h1>
        <p style={subtitle}>
          Computed from your completed interviews — every number traces back
          to stored answers and evaluations.
        </p>

        {error && <div style={errorBox}>{error}</div>}

        {!overview && !error && <p style={subtitle}>Loading…</p>}

        {overview && overview.totalSessions === 0 && (
          <div
            style={{
              ...statCard,
              textAlign: "center",
              padding: "2rem 1rem",
              marginTop: "1rem",
            }}
          >
            <p style={{ fontWeight: 700, margin: "0 0 0.5rem" }}>
              No interviews yet
            </p>
            <p style={{ ...subtitle, margin: 0 }}>
              Complete an interview to see progress, trends, and dimension
              breakdowns here.
            </p>
            <p style={{ marginTop: "1rem" }}>
              <Link to="/interview/setup" style={link}>
                Start your first mock interview →
              </Link>
            </p>
          </div>
        )}

        {overview && overview.totalSessions > 0 && (
          <>
            <div style={statGrid}>
              <div style={statCard}>
                <div style={statValue}>{overview.totalSessions}</div>
                <div style={statLabel}>Total sessions</div>
              </div>
              <div style={statCard}>
                <div style={statValue}>{overview.completedSessions}</div>
                <div style={statLabel}>Completed</div>
              </div>
              <div style={statCard}>
                <div style={statValue}>{overview.inProgressSessions}</div>
                <div style={statLabel}>In progress</div>
              </div>
              <div style={statCard}>
                <div style={statValue}>{fmt(overview.avgOverallScore)}</div>
                <div style={statLabel}>Average score (1–5)</div>
              </div>
              <div style={statCard}>
                <div style={statValue}>{fmt(overview.bestScore)}</div>
                <div style={statLabel}>Best session</div>
              </div>
            </div>

            <h2 style={sectionTitle}>Score by dimension</h2>
            {DIMENSIONS.map((d) => {
              const v = overview.dimensionAverages[d.key];
              return (
                <div key={d.key} style={barRow}>
                  <span style={{ color: "#64748B" }}>{d.label}</span>
                  <div style={barTrack}>
                    <div
                      style={{
                        ...barFill,
                        width: v === null ? "0%" : `${(v / 5) * 100}%`,
                      }}
                    />
                  </div>
                  <span style={{ fontWeight: 700, textAlign: "right" }}>
                    {fmt(v)}
                  </span>
                </div>
              );
            })}

            <h2 style={sectionTitle}>Score trend (last 10 completed)</h2>
            {overview.scoreTrend.length > 0 ? (
              <TrendChart points={overview.scoreTrend} />
            ) : (
              <p style={subtitle}>
                No scored sessions yet — finish an interview to start the
                trend.
              </p>
            )}

            {overview.byLanguage.length > 0 && (
              <>
                <h2 style={sectionTitle}>Sessions by interview language</h2>
                {overview.byLanguage.map((row) => (
                  <div key={row.language} style={barRow}>
                    <span style={{ color: "#64748B" }}>
                      {languageLabel(row.language)}
                    </span>
                    <div style={barTrack}>
                      <div
                        style={{
                          ...barFill,
                          width: `${(row.count / overview.totalSessions) * 100}%`,
                        }}
                      />
                    </div>
                    <span style={{ fontWeight: 700, textAlign: "right" }}>
                      {row.count}
                    </span>
                  </div>
                ))}
              </>
            )}

            {overview.byCategory.length > 0 && (
              <>
                <h2 style={sectionTitle}>Average score by question category</h2>
                {overview.byCategory.map((row) => (
                  <div key={row.category} style={barRow}>
                    <span
                      style={{ color: "#64748B", textTransform: "capitalize" }}
                    >
                      {row.category}
                    </span>
                    <div style={barTrack}>
                      <div
                        style={{
                          ...barFill,
                          width: `${(row.avgScore / 5) * 100}%`,
                        }}
                      />
                    </div>
                    <span style={{ fontWeight: 700, textAlign: "right" }}>
                      {row.avgScore.toFixed(2)}
                    </span>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        <p style={{ marginTop: "1.75rem", fontSize: "0.9rem" }}>
          <Link to="/history" style={link}>
            View session history →
          </Link>{" "}
          ·{" "}
          <Link to="/dashboard" style={link}>
            ← Dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}
