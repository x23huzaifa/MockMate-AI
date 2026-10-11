/**
 * Sign-in page. Client validation mirrors the server rules; server errors
 * (e.g. "Invalid email or password.") are displayed verbatim.
 */
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
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
  title,
} from "./styles";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length === 0) {
      setError("Password is required.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={pageWrap}>
      <main style={card}>
        <h1 style={title}>Welcome back</h1>
        <p style={subtitle}>Sign in to continue your interview practice.</p>
        <form onSubmit={onSubmit} noValidate>
          <label style={label} htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            style={input}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <label style={label} htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            style={input}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
          {error && (
            <div role="alert" style={errorBox}>
              {error}
            </div>
          )}
          <button
            type="submit"
            style={busy ? buttonDisabled : button}
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p style={footerText}>
          No account yet?{" "}
          <Link to="/register" style={link}>
            Create one
          </Link>
        </p>
      </main>
    </div>
  );
}
