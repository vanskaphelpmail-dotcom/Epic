import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { hashPassword } from '@/services/auth.service';
import { Permission, permissionsFromModules } from '@/lib/permissions';
import { writeAudit } from '@/services/audit.service';

export async function createStaff(input: {
  name: string;
  email: string;
  password: string;
  employeeId: string;
  employeeBarcode?: string;
  storeId: string;
  permissions?: Permission[];
  modules?: string[];
  actorId: string;
}) {
  const exists = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.email.toLowerCase() }, { employeeId: input.employeeId }]
    }
  });
  if (exists) throw new AppError('DUPLICATE_RECORD', 'Email or employee ID already exists');

  const permissions =
    input.modules != null
      ? permissionsFromModules(input.modules)
      : input.permissions || [];

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: await hashPassword(input.password),
      employeeId: input.employeeId,
      employeeBarcode: input.employeeBarcode,
      role: 'STAFF',
      storeId: input.storeId,
      permissions: { create: permissions.map((permission) => ({ permission })) }
    },
    include: { permissions: true }
  });

  await writeAudit({
    userId: input.actorId,
    storeId: input.storeId,
    action: 'STAFF_CREATE',
    entity: 'User',
    entityId: user.id,
    newData: { modules: input.modules, permissions }
  });

  return user;
}

export async function updateStaffAccess(input: {
  userId: string;
  modules?: string[];
  permissions?: Permission[];
  isActive?: boolean;
  name?: string;
  password?: string;
  actorId: string;
  storeId?: string | null;
}) {
  const existing = await prisma.user.findUnique({
    where: { id: input.userId },
    include: { permissions: true }
  });
  if (!existing) throw new AppError('NOT_FOUND', 'User not found', 404);

  if (existing.role === 'ADMIN') {
    throw new AppError('FORBIDDEN', 'Shop admin cannot be edited here', 403);
  }

  if (input.password != null && String(input.password).length < 8) {
    throw new AppError('VALIDATION_ERROR', 'Password must be at least 8 characters');
  }

  const nextPermissions =
    input.modules != null
      ? permissionsFromModules(input.modules)
      : input.permissions;

  const passwordHash = input.password ? await hashPassword(String(input.password)) : undefined;

  const user = await prisma.$transaction(async (tx) => {
    if (nextPermissions) {
      await tx.userPermission.deleteMany({ where: { userId: input.userId } });
      for (const permission of nextPermissions) {
        await tx.userPermission.create({
          data: { userId: input.userId, permission }
        });
      }
    }

    return tx.user.update({
      where: { id: input.userId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.isActive != null ? { isActive: input.isActive } : {}),
        ...(passwordHash ? { passwordHash } : {})
      },
      include: { permissions: true }
    });
  });

  await writeAudit({
    userId: input.actorId,
    storeId: input.storeId || existing.storeId,
    action: passwordHash && !nextPermissions ? 'PASSWORD_RESET' : 'PERMISSION_UPDATE',
    entity: 'User',
    entityId: user.id,
    newData: {
      modules: input.modules,
      permissions: nextPermissions || user.permissions.map((p) => p.permission),
      passwordChanged: Boolean(passwordHash)
    }
  });

  return user;
}
