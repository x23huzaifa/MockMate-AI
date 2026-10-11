/**
 * JWT session tokens (HS256) via jose, signed with ENV.JWT_SECRET.
 *
 * env.ts guarantees JWT_SECRET is at least 32 characters at startup, so the
 * "zero-length key" failure class (empty secret → every sign/verify throws a
 * cryptic DataError) cannot occur here. If the secret is missing, the server
 * refuses to boot with a clear named error instead.
 */
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "../_core/env.js";

export const SESSION_COOKIE = "mockmate_session";
const SESSION_TTL = "7d";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const secretKey = new TextEncoder().encode(ENV.JWT_SECRET);

export interface SessionPayload {
  userId: number;
  role: string;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secretKey);
}

/** Returns the session payload, or null for missing/invalid/expired tokens. */
export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    if (
      typeof payload.userId !== "number" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }
    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Secure cookies require HTTPS; local dev runs on plain HTTP.
    secure: ENV.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS,
  };
}
