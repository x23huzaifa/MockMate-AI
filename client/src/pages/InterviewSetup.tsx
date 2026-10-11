/**
 * Interview setup page (/interview/setup, protected).
 *
 * Picks the optional job profile + CV, the four language settings, and the
 * question count, then creates the session and hands off to the runner.
 * Language dropdowns pre-fill from the user's saved defaults
 * (GET /api/v1/settings/languages); Phase D makes them change interview
 * behavior (question bank, feedback language, scoring keywords).
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, LANGUAGE_OPTIONS } from "../lib/api";
import {
  button,
  buttonDisabled,
  card,
  errorBox,
  footerText,
  input,
  label,
  link,
  pageWrap,
  subtitle,
  title,
} from "./styles";

interface JobProfile {
  id: number;
  title: string;
  company: string | null;
}

interface Cv {
  id: number;
  originalFilename: string;
  status: string;
}

interface SettingsPayload {
  settings: {
    interviewLanguage: string;
    responseLanguage: string;
    feedbackLanguage: string;
    evaluationLanguage: string;
  };
  allowed: Record<string, string[]>;
}

export default function InterviewSetup() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<JobProfile[]>([]);
  const [cvs, setCvs] = useState<Cv[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [jobProfileId, setJobProfileId] = useState("");
  const [cvId, setCvId] = useState("");
  const [interviewLanguage, setInterviewLanguage] = useState("en");
  const [responseLanguage, setResponseLanguage] = useState("en");
  const [feedbackLanguage, setFeedbackLanguage] = useState("en");
  const [evaluationLanguage, setEvaluationLanguage] = useState("en");
  const [questionCount, setQuestionCount] = useState(5);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [jp, cv, ls] = await Promise.all([
          api<{ jobProfiles: JobProfile[] }>("/api/v1/job-profiles"),
          api<{ cvs: Cv[] }>("/api/v1/cvs"),
          api<SettingsPayload>("/api/v1/settings/languages").catch(() => null),
        ]);
        if (!cancelled) {
          setProfiles(jp.jobProfiles);
          setCvs(cv.cvs.filter((c) => c.status === "ready"));
          // Pre-fill from saved defaults (silently ignored when unavailable).
          if (ls) {
            setInterviewLanguage(ls.settings.interviewLanguage);
            setResponseLanguage(ls.settings.responseLanguage);
            setFeedbackLanguage(ls.settings.feedbackLanguage);
            setEvaluationLanguage(ls.settings.evaluationLanguage);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const data = await api<{ session: { id: number } }>(
        "/api/v1/interviews",
        {
          method: "POST",
          body: JSON.stringify({
            jobProfileId: jobProfileId === "" ? null : Number(jobProfileId),
            cvId: cvId === "" ? null : Number(cvId),
            interviewLanguage,
            responseLanguage,
            feedbackLanguage,
            evaluationLanguage,
            questionCount,
          }),
        }
      );
      navigate(`/interview/${data.session.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not start.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={pageWrap}>
      <main style={{ ...card, maxWidth: 560 }}>
        <h1 style={title}>New mock interview</h1>
        <p style={subtitle}>
          Set up your practice session. Questions come from a local
          template bank (beta) — matched to your role and skills where
          possible.
        </p>

        {loading && <p style={subtitle}>Loading…</p>}
        {error && <div style={errorBox}>{error}</div>}

        {!loading && !error && (
          <form onSubmit={handleStart}>
            <label style={label} htmlFor="is-job">Job profile (optional)</label>
            <select
              id="is-job"
              style={input}
              value={jobProfileId}
              onChange={(e) => setJobProfileId(e.target.value)}
            >
              <option value="">General interview (no profile)</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {p.company ? ` — ${p.company}` : ""}
                </option>
              ))}
            </select>
            {profiles.length === 0 && (
              <p style={{ fontSize: "0.85rem", color: "#64748B" }}>
                Tip: <Link to="/jobs" style={link}>create a job profile</Link>{" "}
                for role-matched questions.
              </p>
            )}

            <label style={label} htmlFor="is-cv">CV (optional)</label>
            <select
              id="is-cv"
              style={input}
              value={cvId}
              onChange={(e) => setCvId(e.target.value)}
            >
              <option value="">Don't use a CV</option>
              {cvs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.originalFilename}
                </option>
              ))}
            </select>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <div style={{ flex: 1 }}>
                <label style={label} htmlFor="is-lang">Interview language</label>
                <select
                  id="is-lang"
                  style={input}
                  value={interviewLanguage}
                  onChange={(e) => setInterviewLanguage(e.target.value)}
                >
                  {LANGUAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={label} htmlFor="is-response">
                  I'll answer in
                </label>
                <select
                  id="is-response"
                  style={input}
                  value={responseLanguage}
                  onChange={(e) => setResponseLanguage(e.target.value)}
                >
                  {LANGUAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                  <option value="pa-roman">Punjabi (Roman) — experimental</option>
                  <option value="ps">Pashto — experimental</option>
                  <option value="sd">Sindhi — experimental</option>
                  <option value="skb">Saraiki — experimental</option>
                  <option value="bal">Balochi — experimental</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <div style={{ flex: 1 }}>
                <label style={label} htmlFor="is-feedback">
                  Feedback language
                </label>
                <select
                  id="is-feedback"
                  style={input}
                  value={feedbackLanguage}
                  onChange={(e) => setFeedbackLanguage(e.target.value)}
                >
                  {LANGUAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={label} htmlFor="is-eval">
                  Scoring keywords
                </label>
                <select
                  id="is-eval"
                  style={input}
                  value={evaluationLanguage}
                  onChange={(e) => setEvaluationLanguage(e.target.value)}
                >
                  {LANGUAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#64748B", marginTop: "-0.2rem" }}>
              Defaults come from your{" "}
              <Link to="/settings/languages" style={link}>language settings</Link>.
              Any language is accepted in answers — nothing is penalized for language.
            </p>

            <label style={label} htmlFor="is-count">
              Questions: {questionCount}
            </label>
            <input
              id="is-count"
              type="range"
              min={3}
              max={10}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              style={{ width: "100%" }}
            />

            {createError && <div style={errorBox}>{createError}</div>}
            <button
              type="submit"
              style={creating ? buttonDisabled : button}
              disabled={creating}
            >
              {creating ? "Creating…" : "Start interview →"}
            </button>
          </form>
        )}

        <p style={footerText}>
          <Link to="/dashboard" style={link}>← Back to dashboard</Link>
        </p>
      </main>
    </div>
  );
}
