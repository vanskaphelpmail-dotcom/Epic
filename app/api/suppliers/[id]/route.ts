import { AppError, errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission, requirePermission } from '@/services/auth.service';
import { deleteSupplier, getSupplier } from '@/services/supplier.service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAnyPermission('INVENTORY_VIEW', 'PRODUCT_VIEW', 'EXPENSE_VIEW');
    const { id } = await params;
    return ok(await getSupplier(user.storeId || undefined, id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('INVENTORY_EDIT');
    if (!user.storeId) throw new AppError('VALIDATION_ERROR', 'Store is required');
    const { id } = await params;
    return ok(await deleteSupplier({ storeId: user.storeId, userId: user.id, id }));
  } catch (error) {
    return errorResponse(error);
  }
}
