import { errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { getOpsReportData } from '@/services/report.service';

export async function GET(req: Request) {
  try {
    const user = await requireAnyPermission('REPORT_VIEW', 'REPORT_EXPORT', 'SALES_EXPORT', 'STOCK_REPORT_VIEW');
    const search = new URL(req.url).searchParams;
    const data = await getOpsReportData({
      type: search.get('type') || 'sales',
      storeId: user.storeId || undefined,
      period: search.get('period'),
      from: search.get('from'),
      to: search.get('to'),
      q: search.get('q'),
      filters: {
        staff: search.get('staff'),
        status: search.get('status'),
        method: search.get('method'),
        customer: search.get('customer'),
        category: search.get('category'),
        supplier: search.get('supplier'),
        active: search.get('active'),
        employee: search.get('employee'),
        overdue: search.get('overdue'),
        account: search.get('account'),
        direction: search.get('direction')
      }
    });
    return ok(data);
  } catch (error) {
    return errorResponse(error);
  }
}
