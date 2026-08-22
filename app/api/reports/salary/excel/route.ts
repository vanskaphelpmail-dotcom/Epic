import { errorResponse } from '@/lib/errors';
import { requirePermission } from '@/services/auth.service';
import { buildSalaryExcel } from '@/services/report.service';
import { writeAudit } from '@/services/audit.service';

export async function GET(req: Request) {
  try {
    const user = await requirePermission('SALARY_VIEW');
    const params = new URL(req.url).searchParams;
    const period = params.get('period');
    const from = params.get('from');
    const to = params.get('to');
    const { buffer, filename } = await buildSalaryExcel(user.storeId || undefined, {
      period,
      from,
      to
    });
    await writeAudit({
      userId: user.id,
      storeId: user.storeId,
      action: 'REPORT_GENERATION',
      entity: 'SalaryReport',
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
