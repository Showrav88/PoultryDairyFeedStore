import { prisma } from "@/lib/db";
import type { AuditAction, AuditEntity } from "@/generated/prisma/client";

export async function logAudit(
  shopId: string,
  entity: AuditEntity,
  entityId: string,
  action: AuditAction,
  summary: string,
  oldData?: unknown,
  newData?: unknown
) {
  await prisma.auditLog.create({
    data: {
      shopId,
      entity,
      entityId,
      action,
      summary,
      oldData: oldData ? JSON.parse(JSON.stringify(oldData)) : undefined,
      newData: newData ? JSON.parse(JSON.stringify(newData)) : undefined,
    },
  });
}
