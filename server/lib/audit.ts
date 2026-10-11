/**
 * Audit log writer — records admin/security-relevant actions.
 *
 * Every admin mutation calls logAudit AFTER the action succeeds. Failures
 * propagate (loud, via asyncHandler → 500) rather than silently dropping
 * the audit trail. actorUserId = null means "the system itself".
 */
import { db } from "../../drizzle/db.js";
import { auditLogs } from "../../drizzle/schema.js";

export async function logAudit(
  actorUserId: number | null,
  action: string,
  targetType?: string | null,
  targetId?: string | number | null,
  metadata?: Record<string, unknown> | null
): Promise<void> {
  await db.insert(auditLogs).values({
    actorUserId,
    action,
    targetType: targetType ?? null,
    targetId:
      targetId === undefined || targetId === null ? null : String(targetId),
    metadata: metadata ?? null,
  });
}
