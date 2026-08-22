import { AppError, errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission, requireUser } from '@/services/auth.service';
import { createBrand, listBrands } from '@/services/catalog.service';

export async function GET() {
  try {
    const user = await requireAnyPermission(
      'INVENTORY_VIEW',
      'PRODUCT_VIEW',
      'POS_ACCESS',
      'PRODUCT_CREATE',
      'PRODUCT_EDIT'
    );
    if (!user.storeId) throw new AppError('VALIDATION_ERROR', 'Store is required');
    const brands = await listBrands(user.storeId);
    return ok(brands);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const allowed =
      user.role === 'ADMIN' ||
      user.permissions.some((p) =>
        ['INVENTORY_CREATE', 'INVENTORY_EDIT', 'PRODUCT_CREATE', 'PRODUCT_EDIT', 'INVENTORY_VIEW'].includes(
          p
        )
      );
    if (!allowed) {
      throw new AppError('FORBIDDEN', 'You do not have permission to add brands', 403);
    }
    if (!user.storeId) throw new AppError('VALIDATION_ERROR', 'Store is required');
    const body = await req.json().catch(() => ({}));
    const brand = await createBrand(user.storeId, String(body.name || ''));
    return ok(brand, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
