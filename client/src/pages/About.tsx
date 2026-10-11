/**
 * Public about page (/about). What MockMate AI is, who it's for,
 * and honest notes about how it works under the hood.
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
import { SiteLogo } from "../components/logos";

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

const h2: React.CSSProperties = { margin: "1.75rem 0 0.5rem", fontSize: "1.2rem" };

const p: React.CSSProperties = {
  margin: "0 0 0.75rem",
  fontSize: "0.95rem",
  color: "#475569",
};

export default function About() {
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
          style={navLink}
        >
          <SiteLogo />
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
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.8rem" }}>
          About MockMate AI
        </h1>

        <h2 style={h2}>What it is</h2>
        <p style={p}>
          MockMate AI is a mock-interview practice platform. You set up a
          practice session for a target role, answer interview questions in
          writing (or by voice), and get structured feedback on every answer
          plus an overall session report. Your CV can be uploaded and parsed
          so practice stays relevant to your background.
        </p>

        <h2 style={h2}>Who it's for</h2>
        <p style={p}>
          Students, fresh graduates, and job seekers — especially in Pakistan —
          who want to rehearse before the real thing. Practice in English,
          Urdu script, or Roman Urdu, and switch between them freely; the
          platform never penalizes you for the language you answer in.
        </p>

        <h2 style={h2}>How it works, honestly</h2>
        <p style={p}>
          Questions come from a curated, deterministic template bank matched
          to your role and skills — we label this "template-based (beta)"
          wherever it appears. Answer scoring uses a transparent rubric
          (relevance, depth, clarity, structure); it is a practice heuristic,
          <strong> not human judgment and not a hiring prediction</strong>.
          Voice input/output uses your browser's built-in speech features and
          is marked experimental.
        </p>
        <p style={p}>
          We make no claim that practicing here guarantees a job offer. What
          it does give you is reps: realistic questions, honest feedback, and
          a visible record of your improvement over time.
        </p>

        <h2 style={h2}>Your data</h2>
        <p style={p}>
          Your account, CVs, interviews, and reports belong to you. See our{" "}
          <Link to="/privacy" style={{ color: "#4F7CFF", fontWeight: 600 }}>
            privacy policy
          </Link>{" "}
          for exactly what we store and your rights, including deletion.
        </p>

        <div style={{ marginTop: "2rem" }}>
          <Link to="/register" style={{ ...navPrimary, padding: "0.7rem 1.4rem" }}>
            Try it free
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
