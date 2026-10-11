/**
 * Public how-it-works page (/how-it-works). Four honest steps, real links.
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

const step: React.CSSProperties = {
  display: "flex",
  gap: "1rem",
  marginTop: "1.5rem",
};

const stepNum: React.CSSProperties = {
  flexShrink: 0,
  width: "2.25rem",
  height: "2.25rem",
  borderRadius: 999,
  background: "#4F7CFF",
  color: "#ffffff",
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const stepTitle: React.CSSProperties = { margin: "0 0 0.3rem", fontSize: "1.1rem" };

const stepText: React.CSSProperties = {
  margin: 0,
  fontSize: "0.93rem",
  color: "#475569",
};

const ctaRow: React.CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  marginTop: "2rem",
  flexWrap: "wrap",
};

export default function HowItWorks() {
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
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.8rem" }}>How it works</h1>
        <p style={{ margin: "0 0 0.5rem", color: "#64748B" }}>
          From signup to your first interview report in four steps.
        </p>

        <div style={step}>
          <div style={stepNum} aria-hidden="true">1</div>
          <div>
            <h2 style={stepTitle}>Create your free account</h2>
            <p style={stepText}>
              Register with your name, email, and a password. Your sessions,
              CVs, and progress are tied to your account and stay private to
              you.{" "}
              <Link to="/register" style={{ color: "#4F7CFF", fontWeight: 600 }}>
                Create an account
              </Link>
            </p>
          </div>
        </div>

        <div style={step}>
          <div style={stepNum} aria-hidden="true">2</div>
          <div>
            <h2 style={stepTitle}>Upload your CV or pick a target role</h2>
            <p style={stepText}>
              Upload a PDF or DOCX and review what the parser extracts — fix
              anything it gets wrong. Or create a job profile for the role
              you're targeting so questions match it. Either step is optional;
              you can also start a general interview right away.
            </p>
          </div>
        </div>

        <div style={step}>
          <div style={stepNum} aria-hidden="true">3</div>
          <div>
            <h2 style={stepTitle}>Practice the interview</h2>
            <p style={stepText}>
              Answer one question at a time in English, Urdu, or Roman Urdu.
              Pause and resume whenever you need, end early if you've had
              enough, or dictate answers by voice (experimental) — the
              transcript stays editable before you submit.
            </p>
          </div>
        </div>

        <div style={step}>
          <div style={stepNum} aria-hidden="true">4</div>
          <div>
            <h2 style={stepTitle}>Review your report &amp; track progress</h2>
            <p style={stepText}>
              Get per-question feedback — strengths, what to improve, and a
              suggested stronger answer. Scores feed your progress dashboard
              and history, so each session builds on the last. Remember:
              scores are a practice heuristic, not a hiring decision.
            </p>
          </div>
        </div>

        <div style={ctaRow}>
          <Link to="/register" style={{ ...navPrimary, padding: "0.7rem 1.4rem" }}>
            Start your first interview
          </Link>
          <Link to="/features" style={{ ...navGhost, padding: "0.7rem 1.4rem" }}>
            See features
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
