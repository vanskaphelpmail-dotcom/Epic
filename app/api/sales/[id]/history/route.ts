import { errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { listSaleHistory } from '@/services/sales.service';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAnyPermission('SALES_VIEW', 'POS_ACCESS', 'AUDIT_LOG_VIEW');
    const { id } = await ctx.params;
    return ok(await listSaleHistory(id));
  } catch (error) {
    return errorResponse(error);
  }
}
