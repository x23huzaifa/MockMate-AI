/**
 * Environment validation — runs at server startup.
 *
 * CRITICAL RULE: every required variable is validated here with a CLEAR error
 * that names the missing variable. NEVER use silent empty-string fallbacks
 * like `process.env.X ?? ""` for secrets. A sibling project once shipped
 * `cookieSecret: process.env.JWT_SECRET ?? ""`; the empty secret made every
 * session sign/verify fail with a cryptic "Zero-length key is not supported"
 * error and no user could log in. Fail fast with a clear message instead.
 */
import "dotenv/config";

function required(name: string, minLength = 1): string {
  const value = process.env[name];
  if (!value || value.length < minLength) {
    throw new Error(
      `[env] Missing or invalid environment variable: ${name}. ` +
        `Copy .env.example to .env and set a real value.` +
        (minLength > 1
          ? ` It must be at least ${minLength} characters long.`
          : "")
    );
  }
  return value;
}

function port(): number {
  const raw = process.env.PORT ?? "3100";
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0 || value > 65535) {
    throw new Error(
      `[env] Invalid PORT: "${raw}". Must be an integer between 1 and 65535.`
    );
  }
  return value;
}

function optionalEmail(name: string): string | null {
  const raw = process.env[name];
  if (!raw || raw.trim() === "") return null;
  const value = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(
      `[env] Invalid ${name}: "${raw}". ` +
        `Must be a valid email address, or leave it unset for no admin.`
    );
  }
  return value;
}

/**
 * Optional secret: blank counts as unset (fail-closed — never hand a blank
 * key to a provider). Unlike required(), a missing value does NOT throw;
 * features that need it degrade honestly (see AI_SETUP.md).
 */
function optionalSecret(name: string): string | null {
  const raw = process.env[name];
  if (!raw || raw.trim() === "") return null;
  return raw.trim();
}

function optionalModel(name: string): string {
  const raw = process.env[name];
  if (!raw || raw.trim() === "") return "gemini-3.8-flash";
  return raw.trim();
}

function optionalEnum<T extends string>(
  name: string,
  allowed: readonly T[],
  fallback: T
): T {
  const raw = process.env[name];
  if (!raw || raw.trim() === "") return fallback;
  const value = raw.trim().toLowerCase();
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(
      `[env] Invalid ${name}: "${raw}". ` +
        `Must be one of: ${allowed.join(" | ")}.`
    );
  }
  return value as T;
}

export const ENV = {
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: required("JWT_SECRET", 32),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: port(),
  /**
   * Optional bootstrap admin. When set, the user who registers with this
   * email (case-insensitive) gets role='admin' and the assignment is written
   * to audit_logs. When unset, no admin exists and /api/v1/admin is
   * unreachable (every admin route 401/403s). See README for setup.
   */
  ADMIN_EMAIL: optionalEmail("ADMIN_EMAIL"),
  /**
   * Optional Google Gemini API key (AI Studio free tier — see AI_SETUP.md).
   * When unset (or AI_PROVIDER is not "gemini"), the app runs in
   * template/demo mode: the deterministic local engine serves interviews
   * and /api/v1/chat answers 503. Never commit a real key.
   */
  GEMINI_API_KEY: optionalSecret("GEMINI_API_KEY"),
  /** Gemini model id. Defaults to gemini-3.8-flash (best free-tier limits). */
  GEMINI_MODEL: optionalModel("GEMINI_MODEL"),
  /**
   * Which AI engine interviews use: "gemini" (explicit opt-in) or
   * "template" (default demo mode). Gemini additionally requires
   * GEMINI_API_KEY and AI_MODE != "force-template".
   */
  AI_PROVIDER: optionalEnum("AI_PROVIDER", ["gemini", "template"], "template"),
  /**
   * "auto" (default) lets a configured Gemini run; "force-template" pins
   * the built-in engine even when a key is set (useful for demos/tests).
   */
  AI_MODE: optionalEnum("AI_MODE", ["auto", "force-template"], "auto"),
} as const;

export type Env = typeof ENV;
