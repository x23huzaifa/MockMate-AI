/**
 * Public landing page. Honest by design: the API status pill is a real fetch,
 * and every feature bullet describes something actually built and working.
 * Nav buttons link to real routes only.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "./Footer";
import {
  navBar,
  navGhost,
  navLink,
  navPrimary,
  pageWrap,
} from "./styles";

type HealthState = "checking" | "online" | "offline";

const card: React.CSSProperties = {
  maxWidth: 640,
  margin: "8vh auto",
  padding: "2.5rem",
  borderRadius: 16,
  background: "#ffffff",
  boxShadow: "0 12px 40px rgba(11, 16, 32, 0.10)",
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  color: "#182033",
  lineHeight: 1.6,
};

const badge: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#8B5CF6",
  background: "#f1eafe",
  borderRadius: 999,
  padding: "0.2rem 0.7rem",
  marginLeft: "0.6rem",
  verticalAlign: "middle",
};

export default function Landing() {
  const [health, setHealth] = useState<HealthState>("checking");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/health")
      .then((res) => {
        if (!cancelled) setHealth(res.ok ? "online" : "offline");
      })
      .catch(() => {
        if (!cancelled) setHealth("offline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const healthLabel =
    health === "checking"
      ? "checking…"
      : health === "online"
        ? "online"
        : "offline";
  const healthColor =
    health === "online"
      ? "#15803d"
      : health === "offline"
        ? "#b91c1c"
        : "#64748B";

  return (
    <div style={pageWrap}>
      <nav
        style={{
          ...navBar,
          justifyContent: "space-between",
          alignItems: "center",
        }}
        aria-label="Site"
      >
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <Link to="/features" style={navLink}>
            Features
          </Link>
          <Link to="/how-it-works" style={navLink}>
            How it works
          </Link>
          <Link to="/about" style={navLink}>
            About
          </Link>
        </div>
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
        <p
          style={{
            margin: 0,
            fontSize: "0.8rem",
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: "#4F7CFF",
          }}
        >
          WELCOME TO MOCKMATE AI
        </p>
        <h1 style={{ margin: "0.6rem 0", fontSize: "2rem" }}>
          MockMate AI
        </h1>
        <p
          style={{ margin: "0 0 1.5rem", color: "#64748B", fontSize: "1.05rem" }}
        >
          Practice Smarter. Speak Confidently. Get Hired.
        </p>

        <p>
          An AI-powered multilingual mock interview practice platform. Upload
          your CV, pick a target role, and practice full interviews with
          structured feedback — in English, Urdu, or Roman Urdu.
        </p>

        <ul style={{ paddingLeft: "1.2rem" }}>
          <li>
            Mock interviews tailored to your target role, with pause, resume,
            and end-early controls
          </li>
          <li>
            Multilingual practice: English, Urdu, Roman Urdu — separate
            settings for questions, answers, feedback, and scoring
          </li>
          <li>
            Answer scoring with actionable feedback, session reports, and
            progress tracking from your real history
          </li>
          <li>
            CV upload (PDF/DOCX) with parsed skills and experience you can
            review and correct
          </li>
        </ul>

        <p style={{ fontSize: "0.9rem", color: "#64748B" }}>
          Voice input is available as an{" "}
          <span style={badge}>experimental</span> browser feature — text always
          works.
        </p>

        <p style={{ marginTop: "1.75rem" }}>
          API status:{" "}
          <strong style={{ color: healthColor }}>{healthLabel}</strong> —{" "}
          <a href="/api/v1/health" style={{ color: "#4F7CFF" }}>
            /api/v1/health
          </a>
        </p>
      </main>
      <Footer />
    </div>
  );
}
