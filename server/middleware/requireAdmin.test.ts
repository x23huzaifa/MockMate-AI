/**
 * Tests for the admin guard (requireAdmin + isAdminRole).
 *
 * env.ts validates required variables AT IMPORT TIME, so throwaway test
 * secrets are set BEFORE the dynamic imports below — same pattern as
 * server/lib/auth.test.ts.
 *
 * Run: pnpm test
 * Status: WRITTEN, NOT EXECUTED in this environment (no node_modules here).
 */
import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

process.env.JWT_SECRET = "test-secret-that-is-at-least-32-chars-long!";
process.env.DATABASE_URL = "mysql://root:@localhost:3306/test_db";

const { requireAdmin, isAdminRole } = await import("./requireAdmin.js");
const { SESSION_COOKIE, signSession } = await import("../lib/auth.js");

function mockReq(token?: string): Request {
  return { cookies: token ? { [SESSION_COOKIE]: token } : {} } as Request;
}

function mockRes(): { res: Response; seen: { code: number; body: unknown } } {
  const seen = { code: 0, body: null as unknown };
  const res = {
    status(code: number) {
      seen.code = code;
      return res;
    },
    json(body: unknown) {
      seen.body = body;
      return res;
    },
  };
  return { res: res as unknown as Response, seen };
}

describe("isAdminRole", () => {
  it("true only for the exact 'admin' role", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("user")).toBe(false);
    expect(isAdminRole("Admin")).toBe(false);
    expect(isAdminRole("")).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });
});

describe("requireAdmin middleware", () => {
  it("401 when there is no session cookie", async () => {
    const { res, seen } = mockRes();
    const next = vi.fn();
    await requireAdmin(mockReq(), res, next as NextFunction);
    expect(seen.code).toBe(401);
    expect(seen.body).toEqual({ error: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("403 { error: 'Forbidden' } for a signed-in non-admin", async () => {
    const token = await signSession({ userId: 7, role: "user" });
    const { res, seen } = mockRes();
    const next = vi.fn();
    await requireAdmin(mockReq(token), res, next as NextFunction);
    expect(seen.code).toBe(403);
    expect(seen.body).toEqual({ error: "Forbidden" });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() for a signed-in admin", async () => {
    const token = await signSession({ userId: 1, role: "admin" });
    const { res, seen } = mockRes();
    const next = vi.fn();
    await requireAdmin(mockReq(token), res, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
    expect(seen.code).toBe(0); // no error response written
  });

  it("401 for a tampered token", async () => {
    const token = await signSession({ userId: 1, role: "admin" });
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    const { res, seen } = mockRes();
    const next = vi.fn();
    await requireAdmin(mockReq(tampered), res, next as NextFunction);
    expect(seen.code).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
