/**
 * Shared public footer. Real routes only — every link resolves.
 */
import { Link } from "react-router-dom";

const footerStyle: React.CSSProperties = {
  maxWidth: 680,
  margin: "0 auto",
  padding: "0 0.25rem 2rem",
  fontSize: "0.9rem",
  color: "#64748B",
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  textAlign: "center",
  lineHeight: 2,
};

const linkStyle: React.CSSProperties = {
  color: "#4F7CFF",
  fontWeight: 600,
  textDecoration: "none",
  margin: "0 0.7rem",
  whiteSpace: "nowrap",
};

export default function Footer() {
  return (
    <footer style={footerStyle}>
      <Link to="/features" style={linkStyle}>
        Features
      </Link>
      <Link to="/how-it-works" style={linkStyle}>
        How it works
      </Link>
      <Link to="/about" style={linkStyle}>
        About
      </Link>
      <Link to="/contact" style={linkStyle}>
        Contact
      </Link>
      <Link to="/privacy" style={linkStyle}>
        Privacy
      </Link>
      <Link to="/terms" style={linkStyle}>
        Terms
      </Link>
      <Link to="/logo-concepts" style={linkStyle}>
        Logo concepts
      </Link>
    </footer>
  );
}
