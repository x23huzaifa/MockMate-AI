/**
 * Unit tests for server/lib/cvFiles.ts:
 * - magic-byte type detection (bytes decide, never the extension)
 * - private stored-path construction
 * - ownsCv — the authorization decision behind GET/PATCH/DELETE /:id
 *   (route-level IDOR behavior is additionally verified manually on the PC;
 *   see TESTING.md)
 */
import { describe, expect, it } from "vitest";
import {
  buildStoredPath,
  CV_MAX_BYTES,
  detectCvType,
  ownsCv,
} from "./cvFiles.js";

describe("detectCvType", () => {
  it("detects PDF by %PDF magic bytes", () => {
    expect(
      detectCvType(Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))
    ).toBe("pdf");
  });

  it("detects DOCX by zip PK\\x03\\x04 magic bytes", () => {
    expect(
      detectCvType(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]))
    ).toBe("docx");
  });

  it("rejects a renamed executable (MZ header, .pdf extension irrelevant)", () => {
    // bytes decide — a .exe renamed to .pdf is still rejected
    expect(detectCvType(Buffer.from([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();
  });

  it("rejects plain text and random bytes", () => {
    expect(detectCvType(Buffer.from("hello world"))).toBeNull();
    expect(detectCvType(Buffer.from([0x00, 0x01, 0x02, 0x03]))).toBeNull();
  });

  it("rejects short and empty buffers", () => {
    expect(detectCvType(Buffer.from([0x25, 0x50]))).toBeNull();
    expect(detectCvType(Buffer.alloc(0))).toBeNull();
  });

  it("exposes the 5 MB cap", () => {
    expect(CV_MAX_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe("buildStoredPath", () => {
  it("builds user-scoped random paths without the original filename", () => {
    const a = buildStoredPath(7, "pdf");
    const b = buildStoredPath(7, "pdf");
    expect(a).not.toBe(b); // random per upload
    expect(a).toContain("7"); // user-scoped directory
    expect(a.endsWith(".pdf")).toBe(true);
    expect(a).not.toContain("resume"); // original name never leaks
    expect(a).not.toContain("..");
  });

  it("uses the docx extension for docx files", () => {
    expect(buildStoredPath(3, "docx").endsWith(".docx")).toBe(true);
  });
});

describe("ownsCv (PATCH/GET/DELETE authorization)", () => {
  it("allows the owning user", () => {
    expect(ownsCv({ userId: 1 }, 1)).toBe(true);
  });

  it("denies another user's CV (no IDOR)", () => {
    expect(ownsCv({ userId: 2 }, 1)).toBe(false);
  });

  it("denies missing rows", () => {
    expect(ownsCv(null, 1)).toBe(false);
    expect(ownsCv(undefined, 1)).toBe(false);
  });
});
