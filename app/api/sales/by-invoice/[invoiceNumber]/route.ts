import { errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { findSaleByInvoiceNumber } from '@/services/sales.service';

export async function GET(_req: Request, ctx: { params: Promise<{ invoiceNumber: string }> }) {
  try {
    const user = await requireAnyPermission('SALES_VIEW', 'POS_ACCESS');
    const { invoiceNumber } = await ctx.params;
    const sale = await findSaleByInvoiceNumber(
      decodeURIComponent(invoiceNumber),
      user.storeId || undefined
    );
    return ok(sale);
  } catch (error) {
    return errorResponse(error);
  }
}
