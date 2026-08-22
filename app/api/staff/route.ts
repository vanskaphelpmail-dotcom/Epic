import { Role } from '@prisma/client';
import { AppError, errorResponse, ok } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { requireAnyPermission, requirePermission } from '@/services/auth.service';
import { createStaff } from '@/services/user.service';
import {
  ACCESS_MODULES,
  ROLE_PRESETS,
  STAFF_POS_ONLY,
  modulesFromPermissions,
  Permission
} from '@/lib/permissions';

export async function GET() {
  try {
    await requireAnyPermission('STAFF_VIEW', 'ATTENDANCE_VIEW', 'SALARY_VIEW', 'PERMISSION_MANAGE');
    const users = await prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.STAFF] } },
      include: { permissions: true, store: true },
      orderBy: { createdAt: 'asc' }
    });
    return ok({
      users: users.map((u) => {
        const permissions =
          u.role === Role.ADMIN
            ? ACCESS_MODULES.flatMap((m) => m.permissions)
            : u.permissions.map((p) => p.permission);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          employeeId: u.employeeId,
          employeeBarcode: u.employeeBarcode,
          role: u.role,
          isActive: u.isActive,
          storeId: u.storeId,
          permissions,
          modules: u.role === Role.ADMIN ? ACCESS_MODULES.map((m) => m.id) : modulesFromPermissions(permissions)
        };
      }),
      accessModules: ACCESS_MODULES,
      rolePresets: ROLE_PRESETS
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requirePermission('STAFF_CREATE');
    const body = await req.json();
    if (!actor.storeId) throw new AppError('VALIDATION_ERROR', 'Store is required');
    const permissions = (body.permissions || STAFF_POS_ONLY) as Permission[];
    const user = await createStaff({
      name: body.name,
      email: body.email,
      password: body.password || 'Staff123!',
      employeeId: body.employeeId,
      employeeBarcode: body.employeeBarcode,
      storeId: actor.storeId,
      permissions: Array.isArray(body.modules) ? undefined : permissions,
      modules: Array.isArray(body.modules) ? body.modules.map(String) : undefined,
      actorId: actor.id
    });
    return ok(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        employeeId: user.employeeId,
        role: user.role,
        permissions: user.permissions.map((p) => p.permission),
        modules: modulesFromPermissions(user.permissions.map((p) => p.permission))
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
