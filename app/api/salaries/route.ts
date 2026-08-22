import { errorResponse, ok, AppError } from '@/lib/errors';
import { requirePermission } from '@/services/auth.service';
import { createSalaryRecord, listSalariesWithClock } from '@/services/salary.service';

export async function GET() {
  try {
    const actor = await requirePermission('SALARY_VIEW');
    const rows = await listSalariesWithClock(actor.storeId);
    return ok(rows);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requirePermission('SALARY_CREATE');
    if (!actor.storeId) throw new AppError('VALIDATION_ERROR', 'Store is required');
    const body = await req.json();
    if (!body.userId) throw new AppError('VALIDATION_ERROR', 'Employee is required');

    const row = await createSalaryRecord({
      userId: String(body.userId),
      storeId: actor.storeId,
      actorId: actor.id,
      baseSalary: Number(body.baseSalary || 0),
      paidAmount: body.paidAmount != null ? Number(body.paidAmount) : 0,
      periodType: body.periodType === 'month' ? 'month' : 'week',
      periodAnchor: body.periodAnchor || body.periodStart || null,
      periodStart: body.periodStart || null,
      periodEnd: body.periodEnd || null,
      workingDays: body.workingDays != null ? Number(body.workingDays) : undefined,
      workingHours: body.workingHours != null ? Number(body.workingHours) : undefined,
      calculatedSalary:
        body.calculatedSalary != null ? Number(body.calculatedSalary) : undefined,
      expectedHours: body.expectedHours != null ? Number(body.expectedHours) : undefined,
      autoCalculate: body.autoCalculate !== false,
      notes: body.notes ? String(body.notes) : undefined
    });
    return ok(row, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
