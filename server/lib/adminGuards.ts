/**
 * Pure guards for admin role changes — no DB, no env, unit-testable.
 *
 * Rules (both return a human-readable error, or null when allowed):
 * 1. You cannot demote yourself (would lock you out of /admin mid-session).
 * 2. You cannot demote the last remaining admin (would leave the admin
 *    panel permanently unreachable when ADMIN_EMAIL is unset).
 */

export type RoleChangeRequest = {
  targetUserId: number;
  targetRole: string;
  newRole: "user" | "admin";
  actorUserId: number;
  adminCount: number;
};

export function validateRoleChange(req: RoleChangeRequest): string | null {
  if (req.newRole === "user" && req.targetRole === "admin") {
    if (req.targetUserId === req.actorUserId) {
      return "You cannot demote yourself.";
    }
    if (req.adminCount <= 1) {
      return "Cannot demote the last admin.";
    }
  }
  return null;
}

/** Parse ?page&limit into a safe { page, limit, offset }. Limit caps at 100. */
export function parsePagination(query: {
  page?: unknown;
  limit?: unknown;
}): { page: number; limit: number; offset: number } {
  let page = Number(query.page ?? 1);
  let limit = Number(query.limit ?? 20);
  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100;
  return { page, limit, offset: (page - 1) * limit };
}
