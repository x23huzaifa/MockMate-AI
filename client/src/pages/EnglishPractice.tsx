/**
 * English communication practice (protected): four exercise types with
 * feedback and a real history.
 *
 * Feedback is AI-generated (Gemini) when a provider is configured and the
 * UI says so; otherwise a rule-based template gives basic mechanical hints
 * and is labeled "Template feedback". Stats and history come from stored
 * attempts — new users see honest empty states, never fabricated progress.
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

interface Exercise {
  type: string;
  title: string;
  description: string;
  samplePrompts: string[];
}

interface Feedback {
  provider: "gemini" | "template";
  corrections: string[];
  improvedVersion: string | null;
  tips: string[];
}

interface Attempt {
  id: number;
  exerciseType: string;
  prompt: string;
  userText: string;
  feedback: Feedback | null;
  createdAt: string;
}

interface Stats {
  total: number;
  byType: Record<string, number>;
  last7Days: number;
}

const LANGUAGES = [
  { value: "en", label: "Explain in English" },
  { value: "ur", label: "Explain in Urdu" },
  { value: "roman-ur", label: "Explain in Roman Urdu" },
];

const providerBadge: Record<Feedback["provider"], CSSProperties> = {
  gemini: {
    fontSize: "0.75rem",
    fontWeight: 700,
    padding: "0.2rem 0.6rem",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#4F7CFF",
  },
  template: {
    fontSize: "0.75rem",
    fontWeight: 700,
    padding: "0.2rem 0.6rem",
    borderRadius: 999,
    background: "#f1f5f9",
    color: "#64748B",
  },
};

const feedbackBox: CSSProperties = {
  background: "#fbfcfe",
  border: "1px solid #e6eaf2",
  borderRadius: 10,
  padding: "0.9rem",
  marginTop: "0.8rem",
  fontSize: "0.92rem",
};

export default function EnglishPractice() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [activeType, setActiveType] = useState<string>("introduction");
  const [prompt, setPrompt] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [userText, setUserText] = useState("");
  const [language, setLanguage] = useState("en");
  const [submitting, setSubmitting] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<Attempt | null>(null);
  const [history, setHistory] = useState<Attempt[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [ex, hist, st] = await Promise.all([
          api<{ exercises: Exercise[]; aiConfigured: boolean }>(
            "/api/v1/english-practice/exercises"
          ),
          api<{ attempts: Attempt[] }>(
            "/api/v1/english-practice/attempts?limit=10"
          ),
          api<Stats>("/api/v1/english-practice/stats"),
        ]);
        setExercises(ex.exercises);
        setAiConfigured(ex.aiConfigured);
        setHistory(hist.attempts);
        setStats(st);
        const first = ex.exercises[0];
        if (first) {
          setActiveType(first.type);
          setPrompt(first.samplePrompts[0] ?? "");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function pickType(type: string) {
    setActiveType(type);
    const ex = exercises.find((e) => e.type === type);
    setPrompt(ex?.samplePrompts[0] ?? "");
    setCustomPrompt("");
  }

  async function handleSubmit() {
    const finalPrompt = customPrompt.trim() || prompt;
    if (!finalPrompt) {
      setError("Pick or write a prompt first.");
      return;
    }
    if (!userText.trim()) {
      setError("Write your answer before submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const data = await api<{ attempt: Attempt }>(
        "/api/v1/english-practice/attempts",
        {
          method: "POST",
          body: JSON.stringify({
            exerciseType: activeType,
            prompt: finalPrompt,
            userText: userText.trim(),
            language,
          }),
        }
      );
      setLastAttempt(data.attempt);
      setUserText("");
      const [hist, st] = await Promise.all([
        api<{ attempts: Attempt[] }>(
          "/api/v1/english-practice/attempts?limit=10"
        ),
        api<Stats>("/api/v1/english-practice/stats"),
      ]);
      setHistory(hist.attempts);
      setStats(st);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={pageWrap}>
        <p style={{ color: "#64748B", fontFamily: FONT }}>Loading…</p>
      </div>
    );
  }

  const activeExercise = exercises.find((e) => e.type === activeType);

  return (
    <div style={pageWrap}>
      <main style={{ ...card, maxWidth: 760 }}>
        <h1 style={title}>English communication practice</h1>
        <p style={subtitle}>
          Short writing exercises with feedback.{" "}
          {aiConfigured ? (
            <span style={providerBadge.gemini}>AI coach on</span>
          ) : (
            <span style={providerBadge.template}>
              Template feedback — configure an AI provider for detailed coaching
            </span>
          )}
        </p>
        {error && (
          <div style={errorBox} role="alert">
            {error}
          </div>
        )}

        {stats && (
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              flexWrap: "wrap",
              marginBottom: "1rem",
            }}
          >
            {[
              ["Total attempts", stats.total],
              ["This week", stats.last7Days],
            ].map(([k, v]) => (
              <div
                key={k as string}
                style={{
                  border: "1px solid #e6eaf2",
                  borderRadius: 10,
                  padding: "0.5rem 0.9rem",
                  fontSize: "0.85rem",
                }}
              >
                <strong style={{ fontSize: "1.1rem" }}>{v}</strong>
                <div style={{ color: "#64748B" }}>{k}</div>
              </div>
            ))}
            {exercises.map((e) => (
              <div
                key={e.type}
                style={{
                  border: "1px solid #e6eaf2",
                  borderRadius: 10,
                  padding: "0.5rem 0.9rem",
                  fontSize: "0.85rem",
                }}
              >
                <strong style={{ fontSize: "1.1rem" }}>
                  {stats.byType[e.type] ?? 0}
                </strong>
                <div style={{ color: "#64748B" }}>{e.title}</div>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          {exercises.map((e) => (
            <button
              key={e.type}
              type="button"
              onClick={() => pickType(e.type)}
              style={{
                padding: "0.7rem",
                borderRadius: 10,
                border:
                  activeType === e.type
                    ? "2px solid #4F7CFF"
                    : "1px solid #e6eaf2",
                background: activeType === e.type ? "#eef2ff" : "#fff",
                cursor: "pointer",
                fontFamily: FONT,
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#182033",
              }}
              aria-pressed={activeType === e.type}
            >
              {e.title}
            </button>
          ))}
        </div>

        {activeExercise && (
          <p style={{ color: "#64748B", fontSize: "0.9rem" }}>
            {activeExercise.description}
          </p>
        )}

        <label style={label}>Prompt</label>
        <select
          style={input}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setCustomPrompt("");
          }}
          aria-label="Sample prompt"
        >
          {(activeExercise?.samplePrompts ?? []).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option value="">— or write your own below —</option>
        </select>
        <input
          style={{ ...input, marginTop: "0.4rem" }}
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="Or write your own prompt…"
          aria-label="Custom prompt"
        />

        <label style={label}>Your answer</label>
        <textarea
          style={{ ...input, minHeight: 110 }}
          value={userText}
          onChange={(e) => setUserText(e.target.value)}
          placeholder="Write your answer here…"
        />

        <div
          style={{
            display: "flex",
            gap: "0.6rem",
            alignItems: "center",
            flexWrap: "wrap",
            marginTop: "0.6rem",
          }}
        >
          <select
            style={{ ...input, maxWidth: 240 }}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label="Feedback language"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            style={submitting ? buttonDisabled : button}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Checking…" : "Get feedback"}
          </button>
        </div>

        {lastAttempt?.feedback && (
          <FeedbackView feedback={lastAttempt.feedback} />
        )}

        <h2 style={{ fontSize: "1.1rem", margin: "1.5rem 0 0.6rem" }}>
          History
        </h2>
        {(history ?? []).length === 0 ? (
          <p style={{ color: "#64748B", fontSize: "0.9rem" }}>
            No attempts yet — your practice history will appear here after
            your first submission.
          </p>
        ) : (
          (history ?? []).map((a) => (
            <details
              key={a.id}
              style={{
                border: "1px solid #e6eaf2",
                borderRadius: 10,
                padding: "0.7rem 0.9rem",
                marginBottom: "0.5rem",
                fontSize: "0.9rem",
              }}
            >
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                {a.exerciseType} —{" "}
                {new Date(a.createdAt).toLocaleDateString()}{" "}
                {a.feedback && (
                  <span style={providerBadge[a.feedback.provider]}>
                    {a.feedback.provider === "gemini" ? "AI" : "Template"}
                  </span>
                )}
              </summary>
              <p style={{ color: "#64748B" }}>{a.prompt}</p>
              <p>{a.userText}</p>
              {a.feedback && <FeedbackView feedback={a.feedback} compact />}
            </details>
          ))
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

function FeedbackView({
  feedback,
  compact,
}: {
  feedback: Feedback;
  compact?: boolean;
}) {
  return (
    <div style={feedbackBox}>
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          marginBottom: "0.5rem",
        }}
      >
        <strong>Feedback</strong>
        <span style={providerBadge[feedback.provider]}>
          {feedback.provider === "gemini"
            ? "AI-generated"
            : "Template checks"}
        </span>
      </div>
      {feedback.corrections.length > 0 && (
        <>
          <strong style={{ fontSize: "0.88rem" }}>Corrections</strong>
          <ul style={{ margin: "0.3rem 0 0.6rem", paddingLeft: "1.2rem" }}>
            {feedback.corrections.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </>
      )}
      {feedback.improvedVersion && (
        <>
          <strong style={{ fontSize: "0.88rem" }}>Improved version</strong>
          <p
            style={{
              margin: "0.3rem 0 0.6rem",
              padding: "0.6rem",
              background: "#ecfdf5",
              borderRadius: 8,
            }}
          >
            {feedback.improvedVersion}
          </p>
        </>
      )}
      {feedback.tips.length > 0 && !compact && (
        <>
          <strong style={{ fontSize: "0.88rem" }}>Tips</strong>
          <ul style={{ margin: "0.3rem 0 0", paddingLeft: "1.2rem" }}>
            {feedback.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
