/**
 * Unit tests for admin role-change guards and pagination parsing.
 *
 * Pure functions — no DB, no env. These pin the safety rules behind
 * PATCH /api/v1/admin/users/:id/role: you cannot demote yourself, and you
 * cannot demote the last remaining admin.
 *
 * Run: pnpm test
 * Status: WRITTEN, NOT EXECUTED in this environment (no node_modules here).
 */
import { describe, expect, it } from "vitest";
import { parsePagination, validateRoleChange } from "./adminGuards.js";

describe("validateRoleChange", () => {
  it("allows promoting a user to admin", () => {
    expect(
      validateRoleChange({
        targetUserId: 2,
        targetRole: "user",
        newRole: "admin",
        actorUserId: 1,
        adminCount: 1,
      })
    ).toBeNull();
  });

  it("allows demoting another admin when more than one exists", () => {
    expect(
      validateRoleChange({
        targetUserId: 2,
        targetRole: "admin",
        newRole: "user",
        actorUserId: 1,
        adminCount: 3,
      })
    ).toBeNull();
  });

  it("forbids demoting yourself", () => {
    expect(
      validateRoleChange({
        targetUserId: 1,
        targetRole: "admin",
        newRole: "user",
        actorUserId: 1,
        adminCount: 5,
      })
    ).toBe("You cannot demote yourself.");
  });

  it("forbids demoting the last admin", () => {
    expect(
      validateRoleChange({
        targetUserId: 2,
        targetRole: "admin",
        newRole: "user",
        actorUserId: 1,
        adminCount: 1,
      })
    ).toBe("Cannot demote the last admin.");
  });

  it("self-demotion check wins over last-admin check", () => {
    // Demoting yourself IS demoting the last admin when you're the only
    // one — the self rule must fire first for the clearer message.
    expect(
      validateRoleChange({
        targetUserId: 1,
        targetRole: "admin",
        newRole: "user",
        actorUserId: 1,
        adminCount: 1,
      })
    ).toBe("You cannot demote yourself.");
  });

  it("no-op role changes are allowed (route short-circuits before this)", () => {
    expect(
      validateRoleChange({
        targetUserId: 2,
        targetRole: "user",
        newRole: "user",
        actorUserId: 1,
        adminCount: 1,
      })
    ).toBeNull();
  });
});

describe("parsePagination", () => {
  it("defaults to page 1, limit 20, offset 0", () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it("computes offset from page and limit", () => {
    expect(parsePagination({ page: "3", limit: "10" })).toEqual({
      page: 3,
      limit: 10,
      offset: 20,
    });
  });

  it("caps limit at 100", () => {
    expect(parsePagination({ limit: "9999" }).limit).toBe(100);
  });

  it("falls back to defaults on garbage input", () => {
    expect(parsePagination({ page: "abc", limit: "-5" })).toEqual({
      page: 1,
      limit: 20,
      offset: 0,
    });
    expect(parsePagination({ page: "0" }).page).toBe(1);
  });
});
