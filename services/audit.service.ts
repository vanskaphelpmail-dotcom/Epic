import { prisma } from '@/lib/prisma';

export async function writeAudit(input: {
  userId?: string | null;
  storeId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldData?: unknown;
  newData?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId || undefined,
        storeId: input.storeId || undefined,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId || undefined,
        oldData: input.oldData as object | undefined,
        newData: input.newData as object | undefined,
        ip: input.ip || undefined,
        userAgent: input.userAgent || undefined
      }
    });
  } catch (error) {
    console.error('Audit log failed', error);
  }
}
