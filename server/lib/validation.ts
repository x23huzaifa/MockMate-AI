/**
 * Pure input validators for the auth endpoints.
 *
 * No DB access, no env access — deliberately unit-testable in isolation.
 * Each validator returns a human-readable error message, or null when valid.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateName(name: unknown): string | null {
  if (typeof name !== "string" || name.trim().length < 2) {
    return "Name must be at least 2 characters long.";
  }
  if (name.trim().length > 80) {
    return "Name must be at most 80 characters long.";
  }
  return null;
}

export function validateEmail(email: unknown): string | null {
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return "Please enter a valid email address.";
  }
  return null;
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  return null;
}

export function validateRegisterInput(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return "Invalid request body.";
  }
  const { name, email, password } = body as Record<string, unknown>;
  return (
    validateName(name) ??
    validateEmail(email) ??
    validatePassword(password) ??
    null
  );
}

export function validateLoginInput(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return "Invalid request body.";
  }
  const { email, password } = body as Record<string, unknown>;
  const emailError = validateEmail(email);
  if (emailError) return emailError;
  if (typeof password !== "string" || password.length === 0) {
    return "Password is required.";
  }
  return null;
}

export function validateContactInput(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return "Invalid request body.";
  }
  const { name, email, message } = body as Record<string, unknown>;
  // Contact names allow up to 120 chars (the DB column width) — the 80-char
  // account-name rule does not apply here.
  if (typeof name !== "string" || name.trim().length < 2) {
    return "Name must be at least 2 characters long.";
  }
  if (name.trim().length > 120) {
    return "Name must be at most 120 characters long.";
  }
  const emailError = validateEmail(email);
  if (emailError) return emailError;
  if (typeof message !== "string" || message.trim().length === 0) {
    return "Message is required.";
  }
  if (message.trim().length > 2000) {
    return "Message must be at most 2000 characters long.";
  }
  return null;
}
