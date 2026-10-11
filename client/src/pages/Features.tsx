/**
 * Public features page (/features). Honest capability notes only —
 * no "AI-powered" claims for the template engine, voice marked experimental.
 */
import { Link } from "react-router-dom";
import Footer from "./Footer";
import {
  FONT,
  navBar,
  navGhost,
  navLink,
  navPrimary,
  pageWrap,
} from "./styles";

const card: React.CSSProperties = {
  maxWidth: 680,
  margin: "4vh auto",
  padding: "2.5rem",
  borderRadius: 16,
  background: "#ffffff",
  boxShadow: "0 12px 40px rgba(11, 16, 32, 0.10)",
  lineHeight: 1.7,
  color: "#182033",
  fontFamily: FONT,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "1rem",
  marginTop: "1.5rem",
};

const featureCard: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: "1.25rem",
  background: "#F7F8FC",
};

const featureTitle: React.CSSProperties = {
  margin: "0 0 0.5rem",
  fontSize: "1.05rem",
};

const note: React.CSSProperties = {
  margin: "0.75rem 0 0",
  fontSize: "0.82rem",
  color: "#64748B",
  borderTop: "1px dashed #cbd5e1",
  paddingTop: "0.6rem",
};

const badge: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.7rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#8B5CF6",
  background: "#f1eafe",
  borderRadius: 999,
  padding: "0.15rem 0.6rem",
  marginLeft: "0.5rem",
  verticalAlign: "middle",
};

const ctaRow: React.CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  marginTop: "2rem",
  flexWrap: "wrap",
};

export default function Features() {
  return (
    <div style={pageWrap}>
      <nav
        style={{
          ...navBar,
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: 680,
        }}
        aria-label="Site"
      >
        <Link
          to="/"
          style={{ ...navLink, fontWeight: 800, color: "#182033", fontSize: "1rem" }}
        >
          MockMate AI
        </Link>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link to="/login" style={navGhost}>
            Sign in
          </Link>
          <Link to="/register" style={navPrimary}>
            Get started
          </Link>
        </div>
      </nav>

      <main style={card}>
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.8rem" }}>Features</h1>
        <p style={{ margin: "0 0 0.5rem", color: "#64748B" }}>
          Everything below is built and working. Capability notes are honest —
          where something is limited or experimental, we say so.
        </p>

        <div style={grid}>
          <div style={featureCard}>
            <h2 style={featureTitle}>Structured mock interviews</h2>
            <p style={{ margin: 0, fontSize: "0.92rem" }}>
              Role-matched questions, one at a time, with pause, resume, and
              end-early controls. Answers are scored on relevance, depth,
              clarity, and structure with actionable feedback.
            </p>
            <p style={note}>
              Honest note: questions come from a deterministic template bank
              (labeled "beta"), and scoring is a transparent rubric heuristic
              — not human judgment and not a hiring prediction.
            </p>
          </div>

          <div style={featureCard}>
            <h2 style={featureTitle}>CV upload &amp; analysis</h2>
            <p style={{ margin: 0, fontSize: "0.92rem" }}>
              Upload a PDF or DOCX (5 MB max, content-checked). Skills,
              education, and experience are extracted and shown for your
              review — correct anything the parser gets wrong.
            </p>
            <p style={note}>
              Honest note: parsing is rules-based, not AI. Low-confidence
              extractions are labeled as such instead of guessed.
            </p>
          </div>

          <div style={featureCard}>
            <h2 style={featureTitle}>Multilingual practice</h2>
            <p style={{ margin: 0, fontSize: "0.92rem" }}>
              Practice in English, Urdu script, or Roman Urdu — with four
              separate settings for interview, response, feedback, and
              evaluation language. Code-switching is never penalized.
            </p>
            <p style={note}>
              Honest note: non-English support is partial (see our language
              notes). Urdu-script rendering uses RTL layout.
            </p>
          </div>

          <div style={featureCard}>
            <h2 style={featureTitle}>Progress tracking</h2>
            <p style={{ margin: 0, fontSize: "0.92rem" }}>
              Score trends, per-dimension averages, and searchable session
              history — so you can see real improvement over time.
            </p>
            <p style={note}>
              Honest note: every number is computed from your stored sessions.
              Nothing is fabricated; empty states stay empty until you
              practice.
            </p>
          </div>

          <div style={featureCard}>
            <h2 style={featureTitle}>
              Voice input &amp; read-aloud<span style={badge}>experimental</span>
            </h2>
            <p style={{ margin: 0, fontSize: "0.92rem" }}>
              Hear questions read aloud and dictate answers with your
              microphone. Transcripts are always editable before you submit.
            </p>
            <p style={note}>
              Honest note: browser Web Speech API only (best in Chrome/Edge
              desktop). Text input always works as the fallback.
            </p>
          </div>

          <div style={featureCard}>
            <h2 style={featureTitle}>Private by design + admin</h2>
            <p style={{ margin: 0, fontSize: "0.92rem" }}>
              Your CVs, answers, and reports belong to you. Role-based admin
              tooling with an audit log keeps management accountable.
            </p>
            <p style={note}>
              Honest note: admins see session metadata only — never your
              transcripts or CV contents — unless you share them.
            </p>
          </div>
        </div>

        <div style={ctaRow}>
          <Link to="/register" style={{ ...navPrimary, padding: "0.7rem 1.4rem" }}>
            Start practicing free
          </Link>
          <Link to="/how-it-works" style={{ ...navGhost, padding: "0.7rem 1.4rem" }}>
            How it works
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
