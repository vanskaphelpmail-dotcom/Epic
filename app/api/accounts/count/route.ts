import { AppError, errorResponse, ok } from '@/lib/errors';
import { requirePermission } from '@/services/auth.service';
import { recordCashCount } from '@/services/money.service';

export async function POST(req: Request) {
  try {
    const user = await requirePermission('CASH_RECONCILIATION');
    if (!user.storeId) throw new AppError('VALIDATION_ERROR', 'Store is required');
    const body = await req.json();
    const cycle = await recordCashCount({
      storeId: user.storeId,
      userId: user.id,
      actualCash: Number(body.actualCash),
      note: body.note
    });
    return ok(cycle);
  } catch (error) {
    return errorResponse(error);
  }
}
