/**
 * Shared inline styles for auth pages. Same light aesthetic as the landing
 * page: #F7F8FC background, white card, #4F7CFF primary, #8B5CF6 accents.
 */
import type { CSSProperties } from "react";

export const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

export const pageWrap: CSSProperties = {
  background: "#F7F8FC",
  minHeight: "100vh",
  padding: "1rem",
  fontFamily: FONT,
  color: "#182033",
};

export const card: CSSProperties = {
  maxWidth: 440,
  margin: "10vh auto",
  padding: "2.5rem",
  borderRadius: 16,
  background: "#ffffff",
  boxShadow: "0 12px 40px rgba(11, 16, 32, 0.10)",
  lineHeight: 1.6,
};

export const title: CSSProperties = { margin: "0 0 0.4rem", fontSize: "1.6rem" };

export const subtitle: CSSProperties = {
  margin: "0 0 1.5rem",
  color: "#64748B",
};

export const label: CSSProperties = {
  display: "block",
  fontSize: "0.85rem",
  fontWeight: 600,
  margin: "0.9rem 0 0.3rem",
};

export const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "0.65rem 0.8rem",
  fontSize: "1rem",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontFamily: FONT,
};

export const button: CSSProperties = {
  width: "100%",
  marginTop: "1.25rem",
  padding: "0.7rem",
  fontSize: "1rem",
  fontWeight: 700,
  color: "#ffffff",
  background: "#4F7CFF",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontFamily: FONT,
};

export const buttonDisabled: CSSProperties = {
  ...button,
  background: "#94a3b8",
  cursor: "not-allowed",
};

export const errorBox: CSSProperties = {
  marginTop: "1rem",
  padding: "0.7rem 0.9rem",
  borderRadius: 8,
  background: "#fef2f2",
  color: "#b91c1c",
  fontSize: "0.9rem",
};

export const successBox: CSSProperties = {
  marginTop: "1rem",
  padding: "0.7rem 0.9rem",
  borderRadius: 8,
  background: "#ecfdf5",
  color: "#047857",
  fontSize: "0.9rem",
};

export const footerText: CSSProperties = {
  marginTop: "1.25rem",
  fontSize: "0.9rem",
  color: "#64748B",
  textAlign: "center",
};

export const link: CSSProperties = { color: "#4F7CFF", fontWeight: 600 };

export const navBar: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.75rem",
  maxWidth: 680,
  margin: "0 auto",
  padding: "1rem 0.25rem 0",
};

export const navButton: CSSProperties = {
  padding: "0.5rem 1.1rem",
  borderRadius: 8,
  fontSize: "0.9rem",
  fontWeight: 700,
  textDecoration: "none",
  fontFamily: FONT,
};

export const navPrimary: CSSProperties = {
  ...navButton,
  background: "#4F7CFF",
  color: "#ffffff",
};

export const navGhost: CSSProperties = {
  ...navButton,
  background: "#ffffff",
  color: "#182033",
  border: "1px solid #cbd5e1",
};
