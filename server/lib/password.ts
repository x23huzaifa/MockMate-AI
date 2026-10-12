/**
 * Password hashing with bcryptjs (pure JS, 12 salt rounds).
 *
 * bcryptjs chosen over bcrypt: identical API, no native build step
 * (bcrypt's node-gyp postinstall fails under pnpm's ignored-builds
 * policy on Windows). Security rule: plaintext passwords are NEVER
 * logged, stored, or returned. Only hashes leave this module.
 */
import bcrypt from "bcryptjs";

/**
 * Bcrypt cost factor. Default 12 (production). Tests may set BCRYPT_ROUNDS=4
 * via env — bcrypt-12 takes ~5s per hash on low-end hardware, which exceeds
 * the default 5s vitest timeout. Production never sets this; 12 stays.
 */
function saltRounds(): number {
  const raw = Number(process.env.BCRYPT_ROUNDS);
  if (Number.isInteger(raw) && raw >= 4 && raw <= 15) return raw;
  return 12;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, saltRounds());
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
