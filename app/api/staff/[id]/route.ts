import { AppError, errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { updateStaffAccess } from '@/services/user.service';
import { Permission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAnyPermission('STAFF_VIEW', 'PERMISSION_MANAGE');
    const { id } = await ctx.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: { permissions: true }
    });
    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);
    return ok({
      id: user.id,
      name: user.name,
      email: user.email,
      employeeId: user.employeeId,
      role: user.role,
      isActive: user.isActive,
      permissions: user.permissions.map((p) => p.permission)
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAnyPermission('STAFF_EDIT', 'PERMISSION_MANAGE', 'STAFF_CREATE');
    const { id } = await ctx.params;
    const body = await req.json();
    if (body.password && actor.role !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 'Only admin can reset staff passwords', 403);
    }
    const user = await updateStaffAccess({
      userId: id,
      modules: Array.isArray(body.modules) ? body.modules.map(String) : undefined,
      permissions: Array.isArray(body.permissions)
        ? (body.permissions as Permission[])
        : undefined,
      isActive: body.isActive != null ? Boolean(body.isActive) : undefined,
      name: body.name ? String(body.name) : undefined,
      password: body.password ? String(body.password) : undefined,
      actorId: actor.id,
      storeId: actor.storeId
    });
    return ok({
      id: user.id,
      name: user.name,
      email: user.email,
      employeeId: user.employeeId,
      role: user.role,
      isActive: user.isActive,
      permissions: user.permissions.map((p) => p.permission)
    });
  } catch (error) {
    return errorResponse(error);
  }
}
