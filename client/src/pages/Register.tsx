/**
 * Registration page. Client validation mirrors the server rules
 * (name 2–80 chars, valid email, password ≥ 8 chars); server errors
 * (e.g. duplicate email) are displayed verbatim.
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

function validate(name: string, email: string, password: string): string | null {
  if (name.trim().length < 2) return "Name must be at least 2 characters long.";
  if (name.trim().length > 80)
    return "Name must be at most 80 characters long.";
  if (!EMAIL_RE.test(email.trim()))
    return "Please enter a valid email address.";
  if (password.length < 8)
    return "Password must be at least 8 characters long.";
  return null;
}

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const validationError = validate(name, email, password);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await register(name.trim(), email.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={pageWrap}>
      <main style={card}>
        <h1 style={title}>Create your account</h1>
        <p style={subtitle}>Start practicing smarter in under a minute.</p>
        <form onSubmit={onSubmit} noValidate>
          <label style={label} htmlFor="register-name">
            Full name
          </label>
          <input
            id="register-name"
            style={input}
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
          <label style={label} htmlFor="register-email">
            Email
          </label>
          <input
            id="register-email"
            style={input}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <label style={label} htmlFor="register-password">
            Password
          </label>
          <input
            id="register-password"
            style={input}
            type="password"
            autoComplete="new-password"
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
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p style={footerText}>
          Already have an account?{" "}
          <Link to="/login" style={link}>
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
