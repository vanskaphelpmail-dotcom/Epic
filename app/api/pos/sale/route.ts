import { PaymentMethod } from '@prisma/client';
import { AppError, errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { completeSale } from '@/services/pos.service';

export async function POST(req: Request) {
  try {
    const user = await requireAnyPermission('POS_SELL', 'POS_ACCESS');
    if (!user.storeId) throw new AppError('VALIDATION_ERROR', 'User is not assigned to a store');
    const body = await req.json();

    const isAdmin = user.role === 'ADMIN';
    const sale = await completeSale({
      storeId: user.storeId,
      staffId: user.id,
      customerId: body.customerId,
      customer: body.customer || (body.customerName ? { name: body.customerName } : undefined),
      items: body.items || [],
      discount: body.discount,
      discountType: body.discountType === 'PERCENT' ? 'PERCENT' : body.discountType === 'MANUAL' ? 'MANUAL' : 'FIXED',
      discountPercent: body.discountPercent,
      allowDiscount: isAdmin || user.permissions.includes('POS_DISCOUNT'),
      paymentMethod: (body.paymentMethod || 'CASH') as PaymentMethod,
      paymentStatus: body.paymentStatus === 'UNPAID' ? 'UNPAID' : 'PAID',
      cashReceived: body.cashReceived,
      idempotencyKey: body.idempotencyKey || body.clientOperationId,
      taxRate: body.taxRate,
      saleDate: isAdmin ? body.saleDate || null : null,
      allowBackdate: isAdmin,
      channel: body.channel || 'IN_STORE'
    });

    return ok(
      {
        sale,
        invoice: {
          number: sale.invoiceNumber,
          pdfPath: `/api/invoices/${sale.id}/pdf`,
          printPath: `/api/invoices/${sale.id}/print`
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
