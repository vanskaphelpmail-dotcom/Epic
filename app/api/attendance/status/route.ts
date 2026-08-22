import { errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { getAttendanceStatus, getCurrentCashBalance } from '@/services/attendance.service';

export async function GET(req: Request) {
  try {
    const user = await requireAnyPermission('ATTENDANCE_CLOCK_IN', 'ATTENDANCE_CLOCK_OUT', 'ATTENDANCE_VIEW');
    const { searchParams } = new URL(req.url);
    const identifier = searchParams.get('identifier') || user.employeeId || user.id;
    const status = await getAttendanceStatus(identifier);
    const storeBalance = user.storeId
      ? await getCurrentCashBalance(user.storeId, user.id)
      : null;
    return ok({
      ...status,
      storeBalance: storeBalance?.currentBalance ?? status.currentBalance
    });
  } catch (error) {
    return errorResponse(error);
  }
}
