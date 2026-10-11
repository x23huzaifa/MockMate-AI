/**
 * Skill gap analysis (protected): compare a target role's required skills
 * against your confirmed CV skills and skills practiced in completed
 * interviews.
 *
 * Honest labels:
 * - demonstrated — on your confirmed CV
 * - needs evidence — practiced in a completed interview, not on your CV
 * - missing — in neither (NOT proof you lack it; see the disclaimer)
 *
 * The weekly plan is AI-generated when a provider is configured, otherwise
 * a clearly-labeled template plan. Practice questions are always
 * template-generated starting points.
 */
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  FONT,
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

interface JobProfileSummary {
  id: number;
  title: string;
  requiredSkills: string[];
}

interface Inputs {
  cvSkills: string[];
  practicedSkills: string[];
  jobProfiles: JobProfileSummary[];
}

interface Comparison {
  skill: string;
  status: "demonstrated" | "needs-evidence" | "missing";
}

interface Week {
  week: number;
  focus: string;
  actions: string[];
}

interface Analysis {
  targetRole: string;
  comparison: Comparison[];
  practiceQuestions: Record<string, string[]>;
  practiceQuestionsNote: string;
  weeklyPlan: Week[];
  planProvider: "gemini" | "template";
  disclaimer: string;
}

const statusStyle: Record<Comparison["status"], CSSProperties> = {
  demonstrated: { background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" },
  "needs-evidence": { background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" },
  missing: { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" },
};

const statusLabel: Record<Comparison["status"], string> = {
  demonstrated: "Demonstrated",
  "needs-evidence": "Needs evidence",
  missing: "Missing",
};

const chip: CSSProperties = {
  display: "inline-block",
  padding: "0.3rem 0.7rem",
  borderRadius: 999,
  fontSize: "0.82rem",
  fontWeight: 600,
  margin: "0.2rem 0.3rem 0.2rem 0",
};

export default function SkillGap() {
  const [inputs, setInputs] = useState<Inputs | null>(null);
  const [targetRole, setTargetRole] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [profileId, setProfileId] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSkill, setOpenSkill] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api<Inputs>("/api/v1/skill-gap/inputs");
        setInputs(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load your data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleAnalyze() {
    setError(null);
    setAnalyzing(true);
    try {
      const body: Record<string, unknown> = {};
      if (profileId) body.jobProfileId = Number(profileId);
      if (targetRole.trim()) body.targetRole = targetRole.trim();
      if (skillsText.trim()) {
        body.requiredSkills = skillsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      const data = await api<Analysis>("/api/v1/skill-gap/analyze", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setAnalysis(data);
      setOpenSkill(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  function useProfile(id: string) {
    setProfileId(id);
    const p = inputs?.jobProfiles.find((x) => String(x.id) === id);
    if (p) {
      setTargetRole(p.title);
      setSkillsText(p.requiredSkills.join(", "));
    }
  }

  if (loading) {
    return (
      <div style={pageWrap}>
        <p style={{ color: "#64748B", fontFamily: FONT }}>
          Loading your skills…
        </p>
      </div>
    );
  }

  const groups: Comparison["status"][] = [
    "missing",
    "needs-evidence",
    "demonstrated",
  ];

  return (
    <div style={pageWrap}>
      <main style={{ ...card, maxWidth: 760 }}>
        <h1 style={title}>Skill gap analysis</h1>
        <p style={subtitle}>
          Pick a target role and the skills it needs. We compare them with
          your confirmed CV skills and skills you practiced in completed
          interviews.
        </p>
        {error && (
          <div style={errorBox} role="alert">
            {error}
          </div>
        )}

        <div
          style={{
            background: "#fbfcfe",
            border: "1px solid #e6eaf2",
            borderRadius: 12,
            padding: "1rem",
            marginBottom: "1rem",
            fontSize: "0.88rem",
          }}
        >
          <strong>Your confirmed CV skills ({inputs?.cvSkills.length ?? 0}):</strong>{" "}
          <span style={{ color: "#64748B" }}>
            {(inputs?.cvSkills ?? []).join(", ") || "none yet — upload a CV first"}
          </span>
          <br />
          <strong>Practiced in interviews ({inputs?.practicedSkills.length ?? 0}):</strong>{" "}
          <span style={{ color: "#64748B" }}>
            {(inputs?.practicedSkills ?? []).join(", ") || "none yet"}
          </span>
        </div>

        <label style={label}>Or pick a job profile</label>
        <select
          style={input}
          value={profileId}
          onChange={(e) => useProfile(e.target.value)}
          aria-label="Job profile"
        >
          <option value="">— choose —</option>
          {(inputs?.jobProfiles ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        <label style={label}>Target role</label>
        <input
          style={input}
          value={targetRole}
          onChange={(e) => {
            setTargetRole(e.target.value);
            setProfileId("");
          }}
          placeholder="e.g. Frontend Developer"
        />
        <label style={label}>Required skills (comma separated)</label>
        <textarea
          style={{ ...input, minHeight: 70 }}
          value={skillsText}
          onChange={(e) => {
            setSkillsText(e.target.value);
            setProfileId("");
          }}
          placeholder="React, TypeScript, REST APIs, Git"
        />
        <button
          type="button"
          style={analyzing ? buttonDisabled : button}
          onClick={handleAnalyze}
          disabled={analyzing}
        >
          {analyzing ? "Analyzing…" : "Analyze gaps"}
        </button>

        {analysis && (
          <div style={{ marginTop: "1.5rem" }}>
            <h2 style={{ fontSize: "1.15rem", margin: "0 0 0.6rem" }}>
              Gaps for: {analysis.targetRole}
            </h2>
            {groups.map((g) => {
              const items = analysis.comparison.filter(
                (c) => c.status === g
              );
              if (items.length === 0) return null;
              return (
                <div key={g} style={{ marginBottom: "1rem" }}>
                  <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.4rem" }}>
                    {statusLabel[g]} ({items.length})
                  </h3>
                  <div>
                    {items.map((c) => (
                      <span key={c.skill} style={{ ...chip, ...statusStyle[g] }}>
                        {c.skill}
                      </span>
                    ))}
                  </div>
                  {g !== "demonstrated" && (
                    <div style={{ marginTop: "0.5rem" }}>
                      {items.map((c) => (
                        <div key={c.skill} style={{ marginBottom: "0.3rem" }}>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenSkill(openSkill === c.skill ? null : c.skill)
                            }
                            style={{
                              background: "none",
                              border: "none",
                              color: "#4F7CFF",
                              fontWeight: 600,
                              cursor: "pointer",
                              fontSize: "0.88rem",
                              fontFamily: FONT,
                              padding: 0,
                            }}
                            aria-expanded={openSkill === c.skill}
                          >
                            {openSkill === c.skill ? "▾" : "▸"} Practice
                            questions for {c.skill}
                          </button>
                          {openSkill === c.skill && (
                            <ul
                              style={{
                                margin: "0.3rem 0 0.6rem",
                                paddingLeft: "1.2rem",
                                fontSize: "0.9rem",
                                color: "#334155",
                              }}
                            >
                              {(analysis.practiceQuestions[c.skill] ?? []).map(
                                (q, i) => (
                                  <li key={i}>{q}</li>
                                )
                              )}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <p
              style={{
                fontSize: "0.82rem",
                color: "#64748B",
                fontStyle: "italic",
              }}
            >
              {analysis.practiceQuestionsNote}
            </p>

            <h2 style={{ fontSize: "1.15rem", margin: "1.2rem 0 0.6rem" }}>
              Weekly learning plan{" "}
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "0.2rem 0.6rem",
                  borderRadius: 999,
                  background:
                    analysis.planProvider === "gemini" ? "#eef2ff" : "#f1f5f9",
                  color:
                    analysis.planProvider === "gemini" ? "#4F7CFF" : "#64748B",
                }}
              >
                {analysis.planProvider === "gemini"
                  ? "AI-generated"
                  : "Template plan"}
              </span>
            </h2>
            {analysis.weeklyPlan.map((w) => (
              <div
                key={w.week}
                style={{
                  border: "1px solid #e6eaf2",
                  borderRadius: 10,
                  padding: "0.8rem",
                  marginBottom: "0.6rem",
                }}
              >
                <strong>
                  Week {w.week}: {w.focus}
                </strong>
                <ul
                  style={{
                    margin: "0.4rem 0 0",
                    paddingLeft: "1.2rem",
                    fontSize: "0.9rem",
                  }}
                >
                  {w.actions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            ))}

            <div
              style={{
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 10,
                padding: "0.8rem 1rem",
                fontSize: "0.88rem",
                marginTop: "1rem",
              }}
              role="note"
            >
              <strong>Please note:</strong> {analysis.disclaimer}
            </div>
          </div>
        )}

        <p style={{ marginTop: "1.2rem", fontSize: "0.85rem" }}>
          <Link to="/dashboard" style={link}>
            ← Dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}
