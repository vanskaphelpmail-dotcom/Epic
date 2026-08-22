import { AppError, errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { restockProduct, toStaffSafeProduct } from '@/services/product.service';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAnyPermission('INVENTORY_ADJUST', 'PRODUCT_EDIT', 'PRODUCT_CREATE');
    const { id } = await ctx.params;
    const body = await req.json();
    const type = body.type === 'PURCHASE' || body.type === 'ADJUSTMENT' ? body.type : 'RETURN';
    const product = await restockProduct({
      id,
      quantity: Number(body.quantity),
      type,
      reason: body.reason ? String(body.reason) : undefined,
      userId: user.id
    });
    const canSeeCost = user.role === 'ADMIN' || user.permissions.includes('COST_VIEW');
    return ok(toStaffSafeProduct(product, canSeeCost));
  } catch (error) {
    return errorResponse(error);
  }
}
