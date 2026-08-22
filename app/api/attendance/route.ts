import { errorResponse, ok } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { requireAnyPermission } from '@/services/auth.service';

export async function GET() {
  try {
    const user = await requireAnyPermission('ATTENDANCE_VIEW', 'ATTENDANCE_CLOCK_IN', 'CASH_RECONCILIATION');
    const rows = await prisma.attendance.findMany({
      where: {
        ...(user.storeId ? { storeId: user.storeId } : {}),
        ...(user.role === 'ADMIN' ? {} : { userId: user.id })
      },
      include: { user: true, cashSession: true },
      orderBy: { date: 'desc' },
      take: 100
    });
    return ok(rows);
  } catch (error) {
    return errorResponse(error);
  }
}
