import { AppError, errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission, requirePermission } from '@/services/auth.service';
import { createLoan, listLoans } from '@/services/ops.service';

export async function GET() {
  try {
    const user = await requireAnyPermission('EXPENSE_VIEW', 'REPORT_VIEW', 'CASH_RECONCILIATION');
    return ok(await listLoans(user.storeId || undefined));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requirePermission('CASH_RECONCILIATION');
    if (!user.storeId) throw new AppError('VALIDATION_ERROR', 'Store is required');
    const body = await req.json();
    const loan = await createLoan({
      storeId: user.storeId,
      userId: user.id,
      lender: body.lender,
      amount: Number(body.amount),
      paidAmount: body.paidAmount,
      loanDate: body.loanDate,
      dueDate: body.dueDate,
      notes: body.notes
    });
    return ok(loan, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
