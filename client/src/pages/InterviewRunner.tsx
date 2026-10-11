/**
 * Interview runner page (/interview/:id, protected).
 *
 * Drives the session state machine through the API: start (if created),
 * answer submission, pause/resume, interrupt. Shows the current question
 * with a category badge and progress, a textarea for the answer, and the
 * last answer's heuristic score. Completed sessions link to the report.
 *
 * Honest label: "Template-based questions (beta)" — see
 * server/ai/templateProvider.ts.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, statusLabel } from "../lib/api";
import {
  VoiceError,
  cancelSpeech,
  createRecognizer,
  getBestVoice,
  getInstalledVoices,
  getVoiceCapabilities,
  recognitionLangFor,
  speak,
  voiceLanguageLabel,
  type RecognizerHandle,
  type VoiceCapabilities,
  type VoiceLike,
} from "../lib/voice";
import {
  button,
  buttonDisabled,
  card,
  errorBox,
  footerText,
  input,
  link,
  pageWrap,
  subtitle,
  title,
} from "./styles";

interface Session {
  id: number;
  status: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  interviewLanguage: string;
  responseLanguage: string;
  feedbackLanguage: string;
  evaluationLanguage: string;
}

interface Evaluation {
  scores: { relevance: number; depth: number; clarity: number; structure: number };
  overallScore: string | number | null;
  feedbackText: string | null;
}

interface Question {
  id: number;
  orderIndex: number;
  category: string;
  questionText: string;
  answer: { answerText: string } | null;
  evaluation: Evaluation | null;
}

interface StartResponse {
  session: Session;
  question: Question | null;
}

interface AnswerResponse {
  session: Session;
  evaluation: Evaluation | null;
  nextQuestion: Question | null;
  completed: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  introduction: "#8B5CF6",
  technical: "#4F7CFF",
  behavioral: "#10B981",
  situational: "#F59E0B",
};

function categoryBadge(category: string): React.CSSProperties {
  return {
    display: "inline-block",
    fontSize: "0.75rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#ffffff",
    background: CATEGORY_COLORS[category] ?? "#64748B",
    borderRadius: 999,
    padding: "0.2rem 0.7rem",
    marginBottom: "0.6rem",
  };
}

const betaTag: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "#92400e",
  background: "#fef3c7",
  borderRadius: 999,
  padding: "0.2rem 0.7rem",
  marginLeft: "0.5rem",
};

const voiceTag: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "#6d28d9",
  background: "#f3e8ff",
  borderRadius: 999,
  padding: "0.2rem 0.7rem",
  marginLeft: "0.5rem",
};

const noteText: React.CSSProperties = {
  fontSize: "0.82rem",
  color: "#64748B",
  margin: "0.4rem 0 0",
  fontStyle: "italic",
};

const ghostButton: React.CSSProperties = {
  padding: "0.55rem 1rem",
  fontSize: "0.9rem",
  fontWeight: 700,
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  cursor: "pointer",
  fontFamily: "inherit",
};

export default function InterviewRunner() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [current, setCurrent] = useState<Question | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScore, setLastScore] = useState<string | null>(null);

  // Voice (Phase E, experimental): enhancement layer only. The text
  // interview below works identically when voice is unavailable.
  const [caps, setCaps] = useState<VoiceCapabilities | null>(null);
  // null = still checking (Chrome loads voices asynchronously); [] = none.
  const [voices, setVoices] = useState<VoiceLike[] | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [speakNote, setSpeakNote] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognizerRef = useRef<RecognizerHandle | null>(null);

  useEffect(() => {
    setCaps(getVoiceCapabilities());
    let live = true;
    void getInstalledVoices().then((v) => {
      if (live) setVoices(v);
    });
    return () => {
      live = false;
    };
  }, []);

  // Stop any voice activity on unmount so speech/recognition never leak.
  useEffect(() => {
    return () => {
      recognizerRef.current?.abort();
      recognizerRef.current = null;
      cancelSpeech();
    };
  }, []);

  function stopVoiceActivity() {
    recognizerRef.current?.abort();
    recognizerRef.current = null;
    setListening(false);
    setInterim("");
    cancelSpeech();
    setSpeaking(false);
  }

  async function handleListen() {
    if (!current || !session) return;
    if (speaking) {
      cancelSpeech();
      setSpeaking(false);
      return;
    }
    setSpeakNote(null);
    setSpeaking(true);
    try {
      await speak(current.questionText, session.interviewLanguage);
    } catch (err) {
      setSpeakNote(
        err instanceof VoiceError ? err.message : "Could not read the question aloud."
      );
    } finally {
      setSpeaking(false);
    }
  }

  function handleMic() {
    if (!session) return;
    if (listening) {
      recognizerRef.current?.stop();
      return;
    }
    setVoiceError(null);
    setInterim("");
    const rec = createRecognizer(
      session.responseLanguage,
      {
        onResult: (transcript, isFinal) => {
          if (isFinal) {
            // Final results commit into the SAME editable textarea —
            // the user can correct the transcript before submitting.
            setAnswerText((t) => (t ? t + " " : "") + transcript);
            setInterim("");
          } else {
            setInterim(transcript);
          }
        },
        onError: (err) => {
          setVoiceError(err.message);
          setListening(false);
          setInterim("");
          recognizerRef.current = null;
        },
        onEnd: () => {
          setListening(false);
          setInterim("");
          recognizerRef.current = null;
        },
      }
    );
    recognizerRef.current = rec;
    setListening(true);
    rec.start();
  }

  const boot = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await api<{
        session: Session;
        questions: Question[];
      }>(`/api/v1/interviews/${id}`);
      let s = detail.session;
      if (s.status === "created") {
        const started = await api<StartResponse>(
          `/api/v1/interviews/${id}/start`,
          { method: "POST" }
        );
        s = started.session;
        setCurrent(started.question);
      } else if (s.status === "awaiting_answer") {
        setCurrent(detail.questions[s.currentQuestionIndex] ?? null);
      }
      setSession(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load interview.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void boot();
  }, [boot]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || busy || answerText.trim().length === 0) return;
    stopVoiceActivity();
    setBusy(true);
    setError(null);
    try {
      const res = await api<AnswerResponse>(`/api/v1/interviews/${id}/answer`, {
        method: "POST",
        body: JSON.stringify({ answerText }),
      });
      setSession(res.session);
      setAnswerText("");
      if (res.evaluation?.overallScore != null) {
        setLastScore(String(res.evaluation.overallScore));
      }
      setCurrent(res.completed ? null : res.nextQuestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePause() {
    if (!id || busy) return;
    setBusy(true);
    try {
      const res = await api<{ session: Session }>(
        `/api/v1/interviews/${id}/pause`,
        { method: "POST" }
      );
      setSession(res.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pause failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResume() {
    if (!id || busy) return;
    setBusy(true);
    try {
      const res = await api<StartResponse>(`/api/v1/interviews/${id}/resume`, {
        method: "POST",
      });
      setSession(res.session);
      setCurrent(res.question);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resume failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleInterrupt() {
    if (!id || busy) return;
    if (!window.confirm("End this interview early? Answered questions keep their scores.")) {
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ session: Session }>(
        `/api/v1/interviews/${id}/interrupt`,
        { method: "POST" }
      );
      setSession(res.session);
      setCurrent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not end interview.");
    } finally {
      setBusy(false);
    }
  }

  const wordCount = answerText.trim().length === 0
    ? 0
    : answerText.trim().split(/\s+/).length;

  return (
    <div style={pageWrap}>
      <main style={{ ...card, maxWidth: 680 }}>
        <h1 style={title}>
          Mock interview
          <span style={betaTag}>Template-based questions (beta)</span>
          <span
            style={voiceTag}
            title="Voice input and read-aloud use your browser's built-in speech features. Experimental — text always works. See VOICE_SUPPORT.md."
          >
            Voice: experimental
          </span>
        </h1>

        {loading && <p style={subtitle}>Loading…</p>}
        {error && <div style={errorBox}>{error}</div>}

        {!loading && session && (
          <>
            <p style={subtitle}>
              Status: <strong>{statusLabel(session.status)}</strong>
              {session.status === "awaiting_answer" && (
                <>
                  {" · "}Question {session.currentQuestionIndex + 1} of{" "}
                  {session.totalQuestions}
                </>
              )}
            </p>

            {session.status === "awaiting_answer" && current && (
              <form onSubmit={handleSubmit}>
                <div style={categoryBadge(current.category)}>
                  {current.category}
                </div>
                <p
                  dir={session.interviewLanguage === "ur" ? "rtl" : "ltr"}
                  lang={session.interviewLanguage === "ur" ? "ur" : undefined}
                  style={{
                    fontSize: "1.15rem",
                    fontWeight: 600,
                    margin: "0 0 1rem",
                    fontFamily:
                      session.interviewLanguage === "ur"
                        ? "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',system-ui,sans-serif"
                        : undefined,
                    lineHeight: session.interviewLanguage === "ur" ? 2 : undefined,
                  }}
                >
                  {current.questionText}
                </p>
                {caps?.ttsSupported ? (
                  <div style={{ margin: "-0.4rem 0 1rem" }}>
                    <button
                      type="button"
                      style={ghostButton}
                      onClick={handleListen}
                      disabled={busy}
                      title="Read the question aloud using your browser's built-in speech (experimental)"
                    >
                      {speaking ? "⏹ Stop" : "🔊 Listen"}
                    </button>
                    {voices !== null &&
                      !getBestVoice(session.interviewLanguage, voices) && (
                        <p style={noteText}>
                          No {voiceLanguageLabel(session.interviewLanguage)}{" "}
                          voice installed in this browser — showing text.
                        </p>
                      )}
                    {speakNote && <p style={noteText}>{speakNote}</p>}
                  </div>
                ) : (
                  caps !== null && (
                    <p style={{ ...noteText, margin: "-0.4rem 0 1rem" }}>
                      Read-aloud isn't available in this browser — the question
                      is shown as text.
                    </p>
                  )
                )}
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "0.3rem",
                  }}
                  htmlFor="ir-answer"
                >
                  Your answer ({wordCount} words) — any language is fine
                </label>
                <textarea
                  id="ir-answer"
                  style={{ ...input, minHeight: 160, resize: "vertical" }}
                  value={answerText}
                  maxLength={5000}
                  dir="auto"
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Type your answer as you would speak it…"
                  disabled={busy}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    marginTop: "0.6rem",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    style={ghostButton}
                    onClick={handleMic}
                    disabled={busy}
                    title="Dictate your answer with the microphone — the transcript stays editable (experimental)"
                  >
                    {listening ? "⏹ Stop" : "🎤 Speak answer"}
                  </button>
                  {listening && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        fontSize: "0.85rem",
                        color: "#b91c1c",
                        fontWeight: 700,
                      }}
                    >
                      <style>
                        {
                          "@keyframes saathi-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }"
                        }
                      </style>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: "#dc2626",
                          animation: "saathi-pulse 1.2s ease-in-out infinite",
                        }}
                      />
                      Listening… tap to stop
                    </span>
                  )}
                </div>
                {interim !== "" && (
                  <p style={noteText}>Hearing: “{interim}…”</p>
                )}
                {voiceError && <div style={errorBox}>{voiceError}</div>}
                {caps?.sttSupported &&
                  (() => {
                    const mappingNote = recognitionLangFor(
                      session.responseLanguage
                    ).note;
                    return mappingNote !== null ? (
                      <p style={noteText}>{mappingNote}</p>
                    ) : null;
                  })()}
                {caps !== null && !caps.sttSupported && (
                  <p style={noteText}>
                    Voice input isn't supported in this browser — typing works
                    fine.
                  </p>
                )}
                {lastScore !== null && (
                  <p style={{ fontSize: "0.9rem", color: "#047857" }}>
                    Last answer scored <strong>{lastScore} / 5</strong>{" "}
                    (heuristic — see the full report for details).
                  </p>
                )}
                {error && <div style={errorBox}>{error}</div>}
                <button
                  type="submit"
                  style={busy || answerText.trim().length === 0 ? buttonDisabled : button}
                  disabled={busy || answerText.trim().length === 0}
                >
                  {busy ? "Evaluating…" : "Submit answer →"}
                </button>
                <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.75rem" }}>
                  <button type="button" style={ghostButton} onClick={handlePause} disabled={busy}>
                    Pause
                  </button>
                  <button type="button" style={ghostButton} onClick={handleInterrupt} disabled={busy}>
                    End early
                  </button>
                </div>
              </form>
            )}

            {session.status === "paused" && (
              <div>
                <p style={subtitle}>
                  Paused. Your progress is saved — resume whenever you're ready.
                </p>
                <button
                  type="button"
                  style={busy ? buttonDisabled : button}
                  onClick={handleResume}
                  disabled={busy}
                >
                  {busy ? "Resuming…" : "Resume interview →"}
                </button>
              </div>
            )}

            {session.status === "completed" && (
              <div>
                <p style={subtitle}>
                  Interview complete — all {session.totalQuestions} questions
                  answered and evaluated.
                </p>
                <Link
                  to={`/interview/${session.id}/report`}
                  style={{
                    ...button,
                    display: "block",
                    textAlign: "center",
                    textDecoration: "none",
                    boxSizing: "border-box",
                  }}
                >
                  View report →
                </Link>
              </div>
            )}

            {(session.status === "interrupted" || session.status === "failed") && (
              <div>
                <p style={subtitle}>
                  This interview ended ({statusLabel(session.status).toLowerCase()}).
                  {session.status === "interrupted" &&
                    " Your answered questions kept their scores."}
                </p>
                <Link
                  to={`/interview/${session.id}/report`}
                  style={{ ...button, display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}
                >
                  View partial report →
                </Link>
              </div>
            )}

            {session.status !== "completed" &&
              session.status !== "interrupted" &&
              session.status !== "failed" && (
                <p style={footerText}>
                  <Link to="/dashboard" style={link}>← Back to dashboard</Link>
                </p>
              )}
          </>
        )}

        {!loading && !session && !error && (
          <p style={subtitle}>Interview not found.</p>
        )}
      </main>
    </div>
  );
}
