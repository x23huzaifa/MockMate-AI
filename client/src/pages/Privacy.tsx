/**
 * Public privacy policy (/privacy). Plain-language account of what is
 * stored, what is never done, and user rights. Matches the actual
 * implementation (see server/routes/*, drizzle/schema.ts).
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

const li: React.CSSProperties = { marginBottom: "0.4rem", fontSize: "0.95rem", color: "#475569" };

export default function Privacy() {
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
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.8rem" }}>Privacy policy</h1>
        <p style={{ margin: "0 0 0.5rem", color: "#64748B", fontSize: "0.9rem" }}>
          Last updated: October 2026. Plain language, no legalese padding.
        </p>

        <h2 style={h2}>What we store</h2>
        <ul style={{ paddingLeft: "1.2rem", margin: "0 0 0.75rem" }}>
          <li style={li}>
            <strong>Account:</strong> your name, email, and a salted password
            hash. We never store your actual password.
          </li>
          <li style={li}>
            <strong>CVs:</strong> uploaded files plus the extracted fields
            you review and correct. Files live in private server storage,
            never served publicly.
          </li>
          <li style={li}>
            <strong>Interviews:</strong> your job profiles, sessions,
            questions, answers (stored verbatim), and evaluations.
          </li>
          <li style={li}>
            <strong>Settings:</strong> your four language preferences.
          </li>
          <li style={li}>
            <strong>Support messages:</strong> anything you send via the
            contact form.
          </li>
        </ul>

        <h2 style={h2}>What we never do</h2>
        <p style={p}>
          We never sell your data, never show you ads, and never share your
          CVs, answers, or reports with third parties. There is no tracking
          beyond what's needed to run your account.
        </p>

        <h2 style={h2}>Cookies</h2>
        <p style={p}>
          One cookie: a session token (httpOnly, SameSite) that keeps you
          signed in. It expires automatically and is cleared on logout. No
          advertising or analytics cookies.
        </p>

        <h2 style={h2}>Who can see your data</h2>
        <p style={p}>
          Only you, through your signed-in account. Administrators can see
          account and session <em>metadata</em> (for support and safety) but
          do <strong>not</strong> get access to your answer transcripts or CV
          contents by default, and every admin action is written to an audit
          log.
        </p>

        <h2 style={h2}>Your rights</h2>
        <p style={p}>
          You can correct your CV data and profile information at any time
          from inside the app. To delete your account and all associated
          data, send a request via the{" "}
          <Link to="/contact" style={{ color: "#4F7CFF", fontWeight: 600 }}>
            contact form
          </Link>{" "}
          from your registered email address.
        </p>

        <h2 style={h2}>Changes</h2>
        <p style={p}>
          If this policy changes materially, the "last updated" date above
          will change and significant changes will be noted on the sign-in
          page.
        </p>
      </main>

      <Footer />
    </div>
  );
}
