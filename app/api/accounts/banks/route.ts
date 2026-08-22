import { AppError, errorResponse, ok } from '@/lib/errors';
import { requirePermission } from '@/services/auth.service';
import { upsertBankAccount } from '@/services/money.service';

export async function POST(req: Request) {
  try {
    const user = await requirePermission('CASH_RECONCILIATION');
    if (!user.storeId) throw new AppError('VALIDATION_ERROR', 'Store is required');
    const body = await req.json();
    const account = await upsertBankAccount({
      storeId: user.storeId,
      userId: user.id,
      id: body.id,
      name: body.name,
      bankName: body.bankName,
      accountName: body.accountName,
      accountNumber: body.accountNumber,
      accountType: body.accountType,
      branch: body.branch,
      sortCode: body.sortCode,
      openingBalance: body.openingBalance,
      currency: body.currency,
      status: body.status,
      reference: body.reference,
      notes: body.notes,
      kind: body.kind
    });
    return ok(account, { status: body.id ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
