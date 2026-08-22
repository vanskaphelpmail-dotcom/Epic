import { prisma } from '@/lib/prisma';
import { ALL_PERMISSIONS, Permission } from '@/lib/permissions';
import { writeAudit } from '@/services/audit.service';

export async function setUserPermissions(userId: string, permissions: Permission[], actorId: string) {
  const allowed = permissions.filter((p) => ALL_PERMISSIONS.includes(p));
  await prisma.userPermission.deleteMany({ where: { userId } });
  await prisma.userPermission.createMany({
    data: allowed.map((permission) => ({ userId, permission }))
  });
  await writeAudit({
    userId: actorId,
    action: 'PERMISSION_MANAGE',
    entity: 'User',
    entityId: userId,
    newData: { permissions: allowed }
  });
  return allowed;
}
