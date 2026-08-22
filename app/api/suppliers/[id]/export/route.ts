import { errorResponse } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { getSupplier } from '@/services/supplier.service';
import { buildStructuredExcel, buildStructuredPdf } from '@/lib/report-export';
import { pdfFileHeaders } from '@/lib/pdf';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAnyPermission('INVENTORY_VIEW', 'REPORT_VIEW', 'REPORT_EXPORT');
    const { id } = await params;
    const search = new URL(req.url).searchParams;
    const format = search.get('format') === 'excel' ? 'excel' : 'pdf';
    const kind = search.get('kind') || 'all';
    const payload = await getSupplier(user.storeId || undefined, id);
    const supplier = payload.supplier;
    let ledger = payload.ledger || [];
    if (kind === 'purchases') ledger = ledger.filter((e) => e.type === 'PURCHASE');
    if (kind === 'payments') ledger = ledger.filter((e) => e.type === 'PAYMENT');
    const rows = [...ledger].reverse().map((e) => ({
      date: new Date(e.occurredAt || e.createdAt).toLocaleString('en-GB'),
      type: e.type === 'PURCHASE' ? 'Purchase' : 'Payment',
      reference: e.invoiceNumber || e.reference || '',
      amount: e.type === 'PURCHASE' ? Number(e.amount) : -Number(e.amount),
      method: e.method || '-',
      previous: Number(e.previousBalance || 0),
      updated: Number(e.updatedBalance || 0),
      by: e.user?.name || ''
    }));
    const data = {
      type: 'supplier-flow',
      title: `Supplier Payment & Money Flow Report · ${supplier.name}`,
      periodLabel: kind === 'all' ? 'All transactions' : kind,
      columns: [
        { key: 'date', label: 'Date', kind: 'date' as const },
        { key: 'type', label: 'Type' },
        { key: 'reference', label: 'Reference' },
        { key: 'amount', label: 'Amount', kind: 'money' as const },
        { key: 'method', label: 'Method' },
        { key: 'previous', label: 'Previous due', kind: 'money' as const },
        { key: 'updated', label: 'New due', kind: 'money' as const },
        { key: 'by', label: 'By' }
      ],
      rows,
      summaries: [
        { label: 'Total purchase', value: Number(supplier.totalPurchase || 0) },
        { label: 'Total paid', value: Number(supplier.paidAmount || 0) },
        { label: 'Current due', value: Number(supplier.unpaidAmount || 0) },
        { label: 'Transactions', value: rows.length }
      ],
      totalAmount: Number(supplier.unpaidAmount || 0)
    };
    const filename = `${supplier.name.replace(/\s+/g, '_')}_money_flow.${format === 'excel' ? 'xlsx' : 'pdf'}`;
    const result =
      format === 'excel'
        ? await buildStructuredExcel({ data, generatedBy: user.name, filename })
        : await buildStructuredPdf({ data, generatedBy: user.name, filename });
    const body = Buffer.isBuffer(result.buffer) ? result.buffer : Buffer.from(result.buffer as ArrayBuffer);
    return new Response(new Uint8Array(body), {
      headers: pdfFileHeaders(result.filename, result.contentType)
    });
  } catch (error) {
    return errorResponse(error);
  }
}
