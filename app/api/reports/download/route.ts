import { errorResponse } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { buildOpsReportFile } from '@/services/report.service';
import { writeAudit } from '@/services/audit.service';

export async function GET(req: Request) {
  try {
    const user = await requireAnyPermission('REPORT_VIEW', 'REPORT_EXPORT', 'SALES_EXPORT', 'STOCK_REPORT_VIEW');
    const search = new URL(req.url).searchParams;
    const type = search.get('type') || 'sales';
    const format = search.get('format') === 'excel' ? 'excel' : 'pdf';
    const result = await buildOpsReportFile({
      type,
      format,
      storeId: user.storeId || undefined,
      period: search.get('period'),
      from: search.get('from'),
      to: search.get('to'),
      generatedBy: user.name,
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
    await writeAudit({
      userId: user.id,
      storeId: user.storeId,
      action: 'REPORT_VIEW',
      entity: 'Report',
      newData: { type, format }
    });
    const body = Buffer.isBuffer(result.buffer) ? result.buffer : Buffer.from(result.buffer as ArrayBuffer);
    const asciiName = String(result.filename || 'report.bin')
      .replace(/[\u2010-\u2015\u2212]/g, '-')
      .replace(/[^\x20-\x7E]/g, '-')
      .replace(/"/g, '');
    const encodedName = encodeURIComponent(result.filename || asciiName);
    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
