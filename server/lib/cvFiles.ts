/**
 * CV file helpers: magic-byte type detection, private storage paths, and
 * the ownership check used by every per-CV endpoint.
 *
 * All functions are pure (no DB, no env) and unit-testable.
 *
 * Security notes:
 * - File type is decided by magic bytes, never by extension or the
 *   client-supplied MIME type — a renamed .exe is rejected.
 * - The stored filename is random; the original filename is never used on
 *   disk (path traversal via originalname is impossible).
 * - The upload directory is never served statically. Files are reachable
 *   only through the authenticated /api/v1/cvs endpoints, which enforce
 *   per-row ownership (ownsCv) — no IDOR.
 */
import crypto from "node:crypto";
import path from "node:path";

/** 5 MB upload cap (multer enforces this; the route double-checks). */
export const CV_MAX_BYTES = 5 * 1024 * 1024;

/** Project-root-relative directory for stored CVs. Never served statically. */
export const CV_UPLOAD_ROOT = path.join("server", "uploads", "cvs");

export type CvFileType = "pdf" | "docx";

export const CV_MIME_TYPES: Record<CvFileType, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const CV_FILE_EXTENSIONS: Record<CvFileType, string> = {
  pdf: "pdf",
  docx: "docx",
};

/**
 * Detect a CV file type from its first bytes:
 * - PDF  → starts with "%PDF"  (0x25 0x50 0x44 0x46)
 * - DOCX → a zip container "PK\x03\x04" (0x50 0x4B 0x03 0x04)
 * Returns null for anything else (including short/empty buffers).
 */
export function detectCvType(buffer: Buffer): CvFileType | null {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
  const isPdf =
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46;
  if (isPdf) return "pdf";
  const isZip =
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;
  if (isZip) return "docx";
  return null;
}

/**
 * Build the private stored path for an upload:
 *   server/uploads/cvs/<userId>/<random-uuid>.<ext>
 * Per-user directory, random filename — the original filename never appears.
 */
export function buildStoredPath(userId: number, type: CvFileType): string {
  const filename = `${crypto.randomUUID()}.${CV_FILE_EXTENSIONS[type]}`;
  return path.join(CV_UPLOAD_ROOT, String(userId), filename);
}

/**
 * Ownership check for per-CV endpoints. A type guard: after
 * `if (!ownsCv(row, userId)) → 404`, the row is known non-null.
 * Callers answer 404 identically for "not found" and "not mine"
 * (no IDOR information leak).
 */
export function ownsCv(
  cv: { userId: number } | null | undefined,
  userId: number
): cv is { userId: number } {
  return !!cv && cv.userId === userId;
}
