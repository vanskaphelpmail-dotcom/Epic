import { AppError, errorResponse, ok } from '@/lib/errors';
import { requireUser } from '@/services/auth.service';
import { returnSaleItems } from '@/services/sales.service';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 'Only admin can process returns', 403);
    }
    const { id } = await ctx.params;
    const body = await req.json();
    const result = await returnSaleItems(id, {
      items: body.items || [],
      actorId: user.id,
      reason: body.reason,
      condition: body.condition,
      refundMethod: body.refundMethod,
      refundAmount: body.refundAmount != null ? Number(body.refundAmount) : undefined,
      notes: body.notes
    });
    return ok(result);
  } catch (error) {
    return errorResponse(error);
  }
}
