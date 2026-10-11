/**
 * Language settings page (/settings/languages, protected).
 *
 * The four separate settings (interview / response / feedback / evaluation
 * language), each with a plain-language explanation and an honesty badge
 * showing the support level of the selected language. Options per setting
 * come from the server's allowlists — the UI never offers a language the
 * server cannot actually serve.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  filterRelevantVoices,
  getInstalledVoices,
  getVoiceCapabilities,
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
  label,
  link,
  pageWrap,
  subtitle,
  successBox,
  title,
} from "./styles";

type SettingKey =
  | "interviewLanguage"
  | "responseLanguage"
  | "feedbackLanguage"
  | "evaluationLanguage";

interface LanguageInfo {
  code: string;
  label: string;
  script: string;
  direction: "ltr" | "rtl";
  supportLevel: "verified" | "partial" | "experimental" | "unsupported";
  note: string;
}

interface SettingsPayload {
  settings: Record<SettingKey, string>;
  catalog: LanguageInfo[];
  explanations: Record<SettingKey, string>;
  allowed: Record<SettingKey, string[]>;
}

const SETTING_LABELS: Record<SettingKey, string> = {
  interviewLanguage: "Interview language",
  responseLanguage: "Response language / mix",
  feedbackLanguage: "Feedback language",
  evaluationLanguage: "Evaluation language",
};

const LEVEL_COLORS: Record<string, string> = {
  verified: "#047857",
  partial: "#b45309",
  experimental: "#6d28d9",
  unsupported: "#64748B",
};

function levelBadge(level: string): React.CSSProperties {
  return {
    display: "inline-block",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: LEVEL_COLORS[level] ?? "#64748B",
    background: "#f1f5f9",
    borderRadius: 999,
    padding: "0.15rem 0.6rem",
    marginLeft: "0.5rem",
    verticalAlign: "middle",
  };
}

const ORDER: SettingKey[] = [
  "interviewLanguage",
  "responseLanguage",
  "feedbackLanguage",
  "evaluationLanguage",
];

/**
 * Read-only voice diagnostics (Phase E). No toggles — there is nothing to
 * switch on: capabilities depend on the browser and installed OS voices.
 * Text always works regardless of what this panel shows.
 */
function VoiceDiagnostics() {
  const [caps, setCaps] = useState<VoiceCapabilities | null>(null);
  const [voices, setVoices] = useState<VoiceLike[] | null>(null);

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

  if (!caps) return null;
  const relevant = voices ? filterRelevantVoices(voices) : null;

  const row: React.CSSProperties = {
    display: "flex",
    gap: "0.5rem",
    alignItems: "baseline",
    fontSize: "0.9rem",
    margin: "0.35rem 0",
  };

  return (
    <section
      aria-label="Voice diagnostics"
      style={{
        marginTop: "1.75rem",
        paddingTop: "1.25rem",
        borderTop: "1px solid #e2e8f0",
      }}
    >
      <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.5rem" }}>
        Voice (experimental)
        <span style={levelBadge("experimental")}>experimental</span>
      </h2>
      <div style={row}>
        <strong>Speech input (mic):</strong>
        <span>{caps.sttSupported ? "✓ supported" : "✗ not supported"}</span>
      </div>
      <p style={{ fontSize: "0.82rem", color: "#64748B", margin: "0 0 0.6rem" }}>
        {caps.sttNote}
      </p>
      <div style={row}>
        <strong>Read-aloud:</strong>
        <span>{caps.ttsSupported ? "✓ supported" : "✗ not supported"}</span>
      </div>
      <p style={{ fontSize: "0.82rem", color: "#64748B", margin: "0 0 0.6rem" }}>
        {caps.ttsNote}
      </p>
      <div style={row}>
        <strong>English / Urdu voices installed:</strong>
      </div>
      {relevant === null ? (
        <p style={{ fontSize: "0.85rem", color: "#64748B" }}>
          Checking installed voices…
        </p>
      ) : relevant.length === 0 ? (
        <p style={{ fontSize: "0.85rem", color: "#64748B" }}>
          None detected. Read-aloud will show questions as text until a voice
          is installed in your OS/browser language settings.
        </p>
      ) : (
        <ul
          style={{
            fontSize: "0.85rem",
            color: "#334155",
            margin: "0.2rem 0 0.6rem",
            paddingLeft: "1.2rem",
          }}
        >
          {relevant.map((v, i) => (
            <li key={`${v.lang}-${i}`}>
              {v.name} ({v.lang})
            </li>
          ))}
        </ul>
      )}
      <p style={{ fontSize: "0.82rem", color: "#64748B", fontStyle: "italic" }}>
        Diagnostics only — nothing to toggle here. Voice features are
        experimental and vary by browser; the text interview works identically
        either way. Full matrix: <em>VOICE_SUPPORT.md</em>.
      </p>
    </section>
  );
}

export default function LanguageSettings() {
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [values, setValues] = useState<Record<SettingKey, string>>({
    interviewLanguage: "en",
    responseLanguage: "en",
    feedbackLanguage: "en",
    evaluationLanguage: "en",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const payload = await api<SettingsPayload>("/api/v1/settings/languages");
        if (!cancelled) {
          setData(payload);
          setValues(payload.settings);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load settings.");
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await api<{ settings: Record<SettingKey, string> }>(
        "/api/v1/settings/languages",
        { method: "PUT", body: JSON.stringify(values) }
      );
      setValues(res.settings);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  function infoFor(code: string): LanguageInfo | null {
    return data?.catalog.find((c) => c.code === code) ?? null;
  }

  return (
    <div style={pageWrap}>
      <main style={{ ...card, maxWidth: 620 }}>
        <h1 style={title}>Language settings</h1>
        <p style={subtitle}>
          Four separate settings — each controls a different part of your
          interview. These become the defaults for every new session; you can
          still change them per interview.
        </p>

        {loading && <p style={subtitle}>Loading…</p>}
        {error && <div style={errorBox}>{error}</div>}

        {!loading && data && (
          <form onSubmit={handleSave}>
            {ORDER.map((key) => {
              const info = infoFor(values[key]);
              return (
                <div key={key} style={{ marginBottom: "1.1rem" }}>
                  <label style={label} htmlFor={`ls-${key}`}>
                    {SETTING_LABELS[key]}
                    {info && (
                      <span style={levelBadge(info.supportLevel)}>
                        {info.supportLevel}
                      </span>
                    )}
                  </label>
                  <select
                    id={`ls-${key}`}
                    style={input}
                    value={values[key]}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [key]: e.target.value }))
                    }
                  >
                    {data.allowed[key].map((code) => {
                      const opt = infoFor(code);
                      return (
                        <option key={code} value={code}>
                          {opt ? `${opt.label} — ${opt.supportLevel}` : code}
                        </option>
                      );
                    })}
                  </select>
                  <p style={{ fontSize: "0.85rem", color: "#64748B", margin: "0.3rem 0 0" }}>
                    {data.explanations[key]}
                  </p>
                  {info && (
                    <p style={{ fontSize: "0.82rem", color: "#64748B", margin: "0.2rem 0 0", fontStyle: "italic" }}>
                      {info.note}
                    </p>
                  )}
                </div>
              );
            })}

            <div
              style={{
                fontSize: "0.88rem",
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 8,
                padding: "0.7rem 0.9rem",
                marginBottom: "1rem",
                color: "#92400e",
              }}
            >
              Honest note: only <strong>English</strong> (verified) and{" "}
              <strong>Urdu / Roman Urdu</strong> (partial) have real question
              banks and feedback text. Other languages are experimental — your
              answers are always stored exactly as you type them and scored
              with language-neutral heuristics. We never claim full support
              we have not earned. Details: <em>LANGUAGE_SUPPORT.md</em>.
            </div>

            {saved && <div style={successBox}>Saved.</div>}
            {error && <div style={errorBox}>{error}</div>}
            <button
              type="submit"
              style={saving ? buttonDisabled : button}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save settings"}
            </button>
          </form>
        )}

        <VoiceDiagnostics />

        <p style={footerText}>
          <Link to="/dashboard" style={link}>← Back to dashboard</Link>
        </p>
      </main>
    </div>
  );
}
