import { errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { findSellableByBarcode, toStaffSafeProduct } from '@/services/product.service';

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const user = await requireAnyPermission('POS_ACCESS', 'PRODUCT_VIEW');
    const { code } = await ctx.params;
    const product = await findSellableByBarcode(decodeURIComponent(code), user.storeId || undefined);
    const canSeeCost = user.role === 'ADMIN' || user.permissions.includes('COST_VIEW');
    return ok(toStaffSafeProduct(product, canSeeCost));
  } catch (error) {
    return errorResponse(error);
  }
}
