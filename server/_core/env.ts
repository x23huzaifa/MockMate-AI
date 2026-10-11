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

export const ENV = {
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: required("JWT_SECRET", 32),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: port(),
} as const;

export type Env = typeof ENV;
