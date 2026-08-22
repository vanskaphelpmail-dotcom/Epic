import { AppError, errorResponse, ok } from '@/lib/errors';
import { requireUser } from '@/services/auth.service';
import { exchangeSaleItems } from '@/services/sales.service';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 'Only admin can process exchanges', 403);
    }
    const { id } = await ctx.params;
    const body = await req.json();
    const result = await exchangeSaleItems(id, {
      returnProductId: body.returnProductId,
      returnQuantity: Number(body.returnQuantity || 1),
      newProductId: body.newProductId,
      newQuantity: Number(body.newQuantity || 1),
      newSellingPrice: body.newSellingPrice != null ? Number(body.newSellingPrice) : undefined,
      actorId: user.id
    });
    return ok(result);
  } catch (error) {
    return errorResponse(error);
  }
}
