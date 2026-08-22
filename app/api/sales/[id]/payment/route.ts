import { AppError, errorResponse, ok } from '@/lib/errors';
import { requireUser } from '@/services/auth.service';
import { updateSalePayment } from '@/services/sales.service';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== 'ADMIN') throw new AppError('FORBIDDEN', 'Only admin can update sale payments', 403);
    const { id } = await ctx.params;
    const body = await req.json();
    return ok(await updateSalePayment(id, {
      actorId: user.id,
      storeId: user.storeId,
      paymentStatus: body.paymentStatus,
      paymentMethod: body.paymentMethod,
      amount: body.amount != null ? Number(body.amount) : undefined,
      reason: body.reason
    }));
  } catch (error) {
    return errorResponse(error);
  }
}
