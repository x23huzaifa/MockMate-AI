/**
 * Password hashing with bcryptjs (pure JS, 12 salt rounds).
 *
 * bcryptjs chosen over bcrypt: identical API, no native build step
 * (bcrypt's node-gyp postinstall fails under pnpm's ignored-builds
 * policy on Windows). Security rule: plaintext passwords are NEVER
 * logged, stored, or returned. Only hashes leave this module.
 */
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
