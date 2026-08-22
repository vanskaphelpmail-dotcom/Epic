import { errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { clockIn } from '@/services/attendance.service';

export async function POST(req: Request) {
  try {
    const user = await requireAnyPermission('ATTENDANCE_CLOCK_IN');
    const body = await req.json();
    const result = await clockIn({
      identifier: body.identifier || body.employeeId || body.barcode || user.employeeId || user.id,
      openingCash: body.openingCash,
      storeId: body.storeId || user.storeId || undefined,
      actorId: user.id,
      notes: body.notes
    });
    return ok(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
