/**
 * Logo concepts (public): eight distinct SVG marks for MockMate AI, drawn
 * in the existing theme palette. Clicking "Use this logo" stores the pick
 * in localStorage ("mockmate_logo"); the navbar (SiteLogo) renders it.
 * "Reset to default" restores the original text logo.
 */
import { useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  LOGO_CONCEPTS,
  LOGO_STORAGE_KEY,
  LogoMark,
} from "../components/logos";
import type { LogoId, LogoVariant } from "../components/logos";
import { SiteLogo } from "../components/logos";
import {
  FONT,
  button,
  navBar,
  navGhost,
  navLink,
  navPrimary,
  pageWrap,
  subtitle,
  title,
} from "./styles";
import Footer from "./Footer";

const card: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e6eaf2",
  borderRadius: 14,
  padding: "1.25rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.9rem",
};

const variantRow: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  alignItems: "center",
  flexWrap: "wrap",
};

const variantLabel: CSSProperties = {
  fontSize: "0.75rem",
  color: "#64748B",
  width: 64,
};

const pickedBanner: CSSProperties = {
  background: "#ecfdf5",
  color: "#047857",
  border: "1px solid #a7f3d0",
  borderRadius: 10,
  padding: "0.7rem 1rem",
  fontSize: "0.9rem",
  marginBottom: "1rem",
};

function readStored(): LogoId | null {
  try {
    const raw = localStorage.getItem(LOGO_STORAGE_KEY);
    return LOGO_CONCEPTS.some((c) => c.id === raw) ? (raw as LogoId) : null;
  } catch {
    return null;
  }
}

export default function LogoConcepts() {
  const [picked, setPicked] = useState<LogoId | null>(() => readStored());

  function useLogo(id: LogoId) {
    try {
      localStorage.setItem(LOGO_STORAGE_KEY, id);
    } catch {
      // storage unavailable — selection just won't persist
    }
    setPicked(id);
  }

  function reset() {
    try {
      localStorage.removeItem(LOGO_STORAGE_KEY);
    } catch {
      // ignore
    }
    setPicked(null);
  }

  const variants: { variant: LogoVariant; label: string }[] = [
    { variant: "icon", label: "Icon" },
    { variant: "navbar", label: "Navbar" },
    { variant: "light", label: "Light bg" },
    { variant: "dark", label: "Dark bg" },
  ];

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
        <Link to="/" style={navLink}>
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

      <main style={{ maxWidth: 860, margin: "4vh auto", fontFamily: FONT }}>
        <h1 style={title}>Logo concepts</h1>
        <p style={subtitle}>
          Eight directions for the MockMate AI mark — all in the current
          theme colors. Pick one to preview it in the navbar across the
          site, or reset to the original text logo.
        </p>

        {picked && (
          <div style={pickedBanner} role="status">
            Using “{LOGO_CONCEPTS.find((c) => c.id === picked)?.name}” in the
            navbar.{" "}
            <button
              type="button"
              onClick={reset}
              style={{
                ...button,
                padding: "0.3rem 0.7rem",
                fontSize: "0.8rem",
                marginLeft: "0.5rem",
              }}
            >
              Reset to default
            </button>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
            gap: "1rem",
          }}
        >
          {LOGO_CONCEPTS.map((concept) => (
            <section key={concept.id} style={card} aria-label={concept.name}>
              <div>
                <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.05rem" }}>
                  {concept.name}
                  {picked === concept.id && (
                    <span
                      style={{
                        marginLeft: "0.5rem",
                        fontSize: "0.75rem",
                        color: "#047857",
                        fontWeight: 700,
                      }}
                    >
                      ● in use
                    </span>
                  )}
                </h2>
                <p style={{ margin: 0, color: "#64748B", fontSize: "0.88rem" }}>
                  {concept.description}
                </p>
              </div>
              {variants.map(({ variant, label }) => (
                <div key={variant} style={variantRow}>
                  <span style={variantLabel}>{label}</span>
                  <LogoMark id={concept.id} variant={variant} />
                </div>
              ))}
              <div>
                <button
                  type="button"
                  onClick={() => useLogo(concept.id)}
                  style={button}
                  disabled={picked === concept.id}
                >
                  {picked === concept.id ? "In use" : "Use this logo"}
                </button>
              </div>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
