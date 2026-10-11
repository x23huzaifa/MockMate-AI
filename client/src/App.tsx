import { useEffect, useState } from "react";

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

export default function App() {
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
    health === "checking" ? "checking…" : health === "online" ? "online" : "offline";
  const healthColor =
    health === "online" ? "#15803d" : health === "offline" ? "#b91c1c" : "#64748B";

  return (
    <div style={{ background: "#F7F8FC", minHeight: "100vh", padding: "1rem" }}>
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
          WELCOME TO INTERVIEWSAATHI AI
        </p>
        <h1 style={{ margin: "0.6rem 0", fontSize: "2rem" }}>InterviewSaathi AI</h1>
        <p style={{ margin: "0 0 1.5rem", color: "#64748B", fontSize: "1.05rem" }}>
          Practice Smarter. Speak Confidently. Get Hired.
        </p>

        <p>
          An AI-powered multilingual mock interview practice platform. This is an
          early scaffold — the API below is live, and the interview features are
          under construction.
        </p>

        <ul style={{ paddingLeft: "1.2rem" }}>
          <li>
            AI mock interviews tailored to your target role <span style={badge}>Coming soon</span>
          </li>
          <li>
            Multilingual practice: English, Urdu, Roman Urdu <span style={badge}>Coming soon</span>
          </li>
          <li>
            Answer scoring with actionable feedback and progress tracking{" "}
            <span style={badge}>Coming soon</span>
          </li>
        </ul>

        <p style={{ marginTop: "1.75rem" }}>
          API status:{" "}
          <strong style={{ color: healthColor }}>{healthLabel}</strong> —{" "}
          <a href="/api/v1/health" style={{ color: "#4F7CFF" }}>
            /api/v1/health
          </a>
        </p>
      </main>
    </div>
  );
}
