import { AppError, errorResponse, ok } from '@/lib/errors';
import { requirePermission } from '@/services/auth.service';
import {
  buildDocumentsExcel,
  buildDocumentsPdf,
  countMatchingDocuments
} from '@/services/document-export.service';
import { writeAudit } from '@/services/audit.service';
import { pdfFileHeaders } from '@/lib/pdf';

function toNodeBuffer(buffer: ArrayBuffer | Uint8Array | Buffer) {
  if (Buffer.isBuffer(buffer)) return buffer;
  if (buffer instanceof ArrayBuffer) return Buffer.from(new Uint8Array(buffer));
  return Buffer.from(buffer);
}

export async function GET(req: Request) {
  try {
    const user = await requirePermission('DOCUMENT_VIEW');
    const search = new URL(req.url).searchParams;
    const format = (search.get('format') || 'pdf').toLowerCase();
    const year = Number(search.get('year') || 0) || undefined;
    const month = Number(search.get('month') || 0) || undefined;
    const directory = search.get('directory') || undefined;
    const categoryRaw = search.get('category') || undefined;
    const category =
      categoryRaw === 'INVOICE' ? 'SUPPLIER_INVOICE' : categoryRaw === 'TAX' ? 'REPORT' : categoryRaw;
    const filters = { year, month, directory, category };

    if (format === 'count' || format === 'json') {
      return ok(await countMatchingDocuments(user.storeId, filters));
    }

    let buffer: ArrayBuffer | Uint8Array | Buffer;
    let filename: string;
    let contentType: string;

    if (format === 'pdf') {
      ({ buffer, filename } = await buildDocumentsPdf(user.storeId, filters));
      contentType = 'application/pdf';
    } else if (format === 'excel' || format === 'xlsx') {
      ({ buffer, filename } = await buildDocumentsExcel(user.storeId, filters));
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else {
      throw new AppError('VALIDATION_ERROR', 'Use format=pdf or excel');
    }

    await writeAudit({
      userId: user.id,
      storeId: user.storeId,
      action: 'DOCUMENT_EXPORT',
      entity: 'Document',
      newData: { format, filename, ...filters }
    });

    const body = toNodeBuffer(buffer);
    return new Response(new Uint8Array(body), {
      headers: pdfFileHeaders(filename, contentType)
    });
  } catch (error) {
    return errorResponse(error);
  }
}
