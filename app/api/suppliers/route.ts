import { AppError, errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission, requirePermission } from '@/services/auth.service';
import { listSuppliers, upsertSupplier } from '@/services/supplier.service';

export async function GET() {
  try {
    const user = await requireAnyPermission('INVENTORY_VIEW', 'PRODUCT_VIEW', 'EXPENSE_VIEW');
    return ok(await listSuppliers(user.storeId || undefined));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requirePermission('INVENTORY_EDIT');
    if (!user.storeId) throw new AppError('VALIDATION_ERROR', 'Store is required');
    const body = await req.json();
    const supplier = await upsertSupplier({
      storeId: user.storeId,
      userId: user.id,
      id: body.id,
      name: body.name,
      email: body.email,
      phone: body.phone,
      address: body.address,
      notes: body.notes,
      dueDate: body.dueDate,
      totalPurchase: body.totalPurchase,
      paidAmount: body.paidAmount,
      unpaidAmount: body.unpaidAmount,
      paymentMethod: body.paymentMethod,
      paymentReference: body.paymentReference || body.reference,
      isActive: body.isActive
    });
    return ok(supplier, { status: body.id ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
