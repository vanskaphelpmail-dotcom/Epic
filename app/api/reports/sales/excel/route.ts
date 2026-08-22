import { errorResponse } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { buildSalesExcel } from '@/services/report.service';
import { writeAudit } from '@/services/audit.service';

export async function GET(req: Request) {
  try {
    const user = await requireAnyPermission('SALES_EXPORT', 'REPORT_EXPORT');
    const params = new URL(req.url).searchParams;
    const period = params.get('period');
    const from = params.get('from');
    const to = params.get('to');
    const { buffer, filename } = await buildSalesExcel(user.storeId || undefined, {
      period,
      from,
      to
    });
    await writeAudit({
      userId: user.id,
      storeId: user.storeId,
      action: 'REPORT_GENERATION',
      entity: 'SalesReport',
      newData: { filename, period, from, to }
    });
    return new Response(Buffer.from(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
