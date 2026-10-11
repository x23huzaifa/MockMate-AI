/**
 * Public contact page (/contact) — no sign-in required.
 *
 * Validates name/email/message client-side (the server re-validates),
 * shows field errors inline, and surfaces the server's 429 rate-limit
 * message plainly. On success the form clears and shows a confirmation;
 * the stored message is never echoed back.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  button,
  card,
  errorBox,
  input,
  label,
  link,
  pageWrap,
  successBox,
  title,
  subtitle,
} from "./styles";

const fieldError: React.CSSProperties = {
  color: "#b91c1c",
  fontSize: "0.85rem",
  marginTop: "0.25rem",
};

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Please enter your name.";
    else if (name.trim().length > 120)
      e.name = "Name must be at most 120 characters.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = "Please enter a valid email address.";
    if (message.trim().length === 0) e.message = "Please write a message.";
    else if (message.trim().length > 2000)
      e.message = "Message must be at most 2000 characters.";
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSending(true);
    setServerError(null);
    try {
      const res = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });
      if (!res.ok) {
        let msg = `Request failed (HTTP ${res.status}).`;
        try {
          const body = (await res.json()) as { error?: unknown };
          if (typeof body.error === "string") msg = body.error;
        } catch {
          /* keep default */
        }
        throw new Error(msg);
      }
      setSent(true);
      setName("");
      setEmail("");
      setMessage("");
      setErrors({});
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={pageWrap}>
      <main style={card}>
        <h1 style={title}>Contact us</h1>
        <p style={subtitle}>
          Questions, feedback, or a bug report — we read every message.
        </p>

        {sent && (
          <div style={successBox}>
            Message sent. Thank you — we&apos;ll get back to you at the email
            you provided.
          </div>
        )}
        {serverError && <div style={errorBox}>{serverError}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <label style={label} htmlFor="contact-name">
            Name
          </label>
          <input
            id="contact-name"
            style={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoComplete="name"
          />
          {errors.name && <div style={fieldError}>{errors.name}</div>}

          <label style={label} htmlFor="contact-email">
            Email
          </label>
          <input
            id="contact-email"
            style={input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {errors.email && <div style={fieldError}>{errors.email}</div>}

          <label style={label} htmlFor="contact-message">
            Message
          </label>
          <textarea
            id="contact-message"
            style={{ ...input, minHeight: 140, resize: "vertical" }}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
          />
          <div
            style={{
              fontSize: "0.8rem",
              color: "#64748B",
              textAlign: "right",
              marginTop: "0.2rem",
            }}
          >
            {message.length}/2000
          </div>
          {errors.message && <div style={fieldError}>{errors.message}</div>}

          <button type="submit" style={button} disabled={sending}>
            {sending ? "Sending…" : "Send message"}
          </button>
        </form>

        <p style={{ marginTop: "1.25rem", fontSize: "0.9rem", textAlign: "center" }}>
          <Link to="/" style={link}>
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
