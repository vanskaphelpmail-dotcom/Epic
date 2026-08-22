import { errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { clockOut } from '@/services/attendance.service';

export async function POST(req: Request) {
  try {
    const user = await requireAnyPermission('ATTENDANCE_CLOCK_OUT');
    const body = await req.json();
    const result = await clockOut({
      identifier: body.identifier || body.employeeId || body.barcode || user.employeeId || user.id,
      closingCash: body.closingCash,
      storeId: body.storeId || user.storeId || undefined,
      actorId: user.id,
      notes: body.notes
    });
    return ok(result);
  } catch (error) {
    return errorResponse(error);
  }
}
