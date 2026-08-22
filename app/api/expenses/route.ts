import { PaymentStatus } from '@prisma/client';
import { errorResponse, ok, AppError } from '@/lib/errors';
import { requireAnyPermission, requirePermission } from '@/services/auth.service';
import { createExpense, listExpenses } from '@/services/ops.service';

export async function GET() {
  try {
    const user = await requireAnyPermission('EXPENSE_VIEW', 'REPORT_VIEW', 'DASHBOARD_VIEW');
    return ok(await listExpenses(user.storeId || undefined));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requirePermission('EXPENSE_CREATE');
    if (!user.storeId) throw new AppError('VALIDATION_ERROR', 'Store is required');
    const body = await req.json();
    const expense = await createExpense({
      storeId: user.storeId,
      userId: user.id,
      category: body.category,
      categoryLabel: body.categoryLabel || body.category,
      amount: Number(body.amount),
      description: body.description,
      expenseDate: body.expenseDate,
      dueDate: body.dueDate,
      paymentStatus: (body.paymentStatus || 'UNPAID') as PaymentStatus,
      reference: body.reference
    });
    return ok(expense, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
