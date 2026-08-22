import { AppError, errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission, requireUser } from '@/services/auth.service';
import { updateSale, voidSale } from '@/services/sales.service';
import { prisma } from '@/lib/prisma';
import { assertSameStore } from '@/lib/store-access';

function assertAdmin(user: { role: string }) {
  if (user.role !== 'ADMIN') {
    throw new AppError('FORBIDDEN', 'Only admin can edit, delete, return or exchange invoices', 403);
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAnyPermission('SALES_VIEW', 'POS_ACCESS');
    const { id } = await ctx.params;
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { items: true, customer: true, staff: true }
    });
    if (!sale) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    assertSameStore(user, sale.storeId, 'Invoice not found');
    return ok(sale);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    assertAdmin(user);
    const { id } = await ctx.params;
    const body = await req.json();
    const sale = await updateSale(id, {
      customerName: body.customerName,
      notes: body.notes,
      saleDate: body.saleDate,
      discountType: body.discountType === 'percent' ? 'percent' : 'fixed',
      discountValue: body.discountValue != null ? Number(body.discountValue) : undefined,
      deliveryCharge: body.deliveryCharge != null ? Number(body.deliveryCharge) : undefined,
      taxRate: body.taxRate != null ? Number(body.taxRate) : undefined,
      paymentMethod: body.paymentMethod,
      paymentStatus: body.paymentStatus,
      reason: body.reason,
      items: Array.isArray(body.items) ? body.items : undefined,
      actorId: user.id,
      storeId: user.storeId
    });
    return ok(sale);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    assertAdmin(user);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const sale = await voidSale(id, user.id, body.reason, user.storeId);
    return ok(sale);
  } catch (error) {
    return errorResponse(error);
  }
}
