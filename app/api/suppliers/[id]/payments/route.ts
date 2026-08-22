import { AppError, errorResponse, ok } from '@/lib/errors';
import { requirePermission } from '@/services/auth.service';
import { addSupplierPayment } from '@/services/supplier.service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('INVENTORY_EDIT');
    if (!user.storeId) throw new AppError('VALIDATION_ERROR', 'Store is required');
    const { id } = await params;
    const body = await req.json();
    return ok(await addSupplierPayment({
      storeId: user.storeId,
      userId: user.id,
      supplierId: id,
      amount: Number(body.amount),
      paymentDate: body.paymentDate,
      method: body.method || body.paymentMethod,
      accountId: body.accountId,
      reference: body.reference,
      notes: body.notes
    }), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
