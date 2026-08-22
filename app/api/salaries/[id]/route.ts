import { AppError, errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { paySalary, updateSalaryRecord } from '@/services/salary.service';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAnyPermission('SALARY_EDIT', 'SALARY_PAYMENT', 'SALARY_CREATE');
    const { id } = await ctx.params;
    const body = await req.json();
    const canPay =
      actor.role === 'ADMIN' ||
      (Array.isArray(actor.permissions) && actor.permissions.includes('SALARY_PAYMENT'));

    if (body.action === 'pay_full' || body.action === 'pay_partial') {
      if (!canPay) {
        throw new AppError('FORBIDDEN', 'Salary payment permission required', 403);
      }
      const row = await paySalary({
        id,
        actorId: actor.id,
        storeId: actor.storeId,
        mode: body.action === 'pay_full' ? 'full' : 'partial',
        amount: body.amount != null ? Number(body.amount) : undefined
      });
      return ok(row);
    }

    const row = await updateSalaryRecord({
      id,
      actorId: actor.id,
      storeId: actor.storeId,
      baseSalary: body.baseSalary != null ? Number(body.baseSalary) : undefined,
      calculatedSalary:
        body.calculatedSalary != null ? Number(body.calculatedSalary) : undefined,
      paidAmount: body.paidAmount != null ? Number(body.paidAmount) : undefined,
      workingDays: body.workingDays != null ? Number(body.workingDays) : undefined,
      workingHours: body.workingHours != null ? Number(body.workingHours) : undefined,
      notes: body.notes != null ? String(body.notes) : undefined,
      recalculate: Boolean(body.recalculate),
      periodType:
        body.periodType === 'month' ? 'month' : body.periodType === 'week' ? 'week' : undefined,
      expectedHours: body.expectedHours != null ? Number(body.expectedHours) : undefined
    });
    return ok(row);
  } catch (error) {
    return errorResponse(error);
  }
}
