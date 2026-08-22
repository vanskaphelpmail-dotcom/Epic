import { errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { listSales } from '@/services/sales.service';

export async function GET(req: Request) {
  try {
    const user = await requireAnyPermission('SALES_VIEW', 'POS_ACCESS');
    const { searchParams } = new URL(req.url);
    const ownOnly = user.role !== 'ADMIN' && !user.permissions.includes('SALES_REPORT_VIEW');
    const sales = await listSales({
      storeId: user.storeId || undefined,
      staffId: ownOnly ? user.id : searchParams.get('staffId') || undefined,
      q: searchParams.get('q') || undefined,
      paymentStatus: searchParams.get('paymentStatus') === 'UNPAID' ? 'UNPAID' : searchParams.get('paymentStatus') === 'PAID' ? 'PAID' : undefined,
      limit: Number(searchParams.get('limit') || 100)
    });
    return ok(sales);
  } catch (error) {
    return errorResponse(error);
  }
}
