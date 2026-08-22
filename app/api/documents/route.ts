import { DocumentCategory, DocumentDirectory } from '@prisma/client';
import { AppError, errorResponse, ok } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { requireAnyPermission, requirePermission } from '@/services/auth.service';
import { writeAudit } from '@/services/audit.service';
import { saveDocumentPdf } from '@/lib/uploads';

function asCategory(value: string): DocumentCategory {
  if (value === 'INVOICE') return DocumentCategory.SUPPLIER_INVOICE;
  if (value === 'TAX') return DocumentCategory.REPORT;
  const allowed = new Set(Object.values(DocumentCategory));
  if (allowed.has(value as DocumentCategory)) return value as DocumentCategory;
  return DocumentCategory.OTHER;
}

export async function GET() {
  try {
    const user = await requireAnyPermission('DOCUMENT_VIEW');
    const docs = await prisma.document.findMany({
      where: {
        ...(user.storeId ? { storeId: user.storeId } : {}),
        ...(user.role === 'ADMIN'
          ? {}
          : {
              OR: [{ uploadedById: user.id }, { employeeId: user.id }],
              NOT: {
                AND: [
                  { title: { contains: 'Payslip', mode: 'insensitive' } },
                  { employeeId: { not: user.id } }
                ]
              }
            })
      },
      include: { uploadedBy: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return ok(docs);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requirePermission('DOCUMENT_UPLOAD');
    if (!user.storeId) throw new AppError('VALIDATION_ERROR', 'Store is required');
    const contentType = req.headers.get('content-type') || '';
    let title = '';
    let category = 'OTHER';
    let directory = 'INVOICE';
    let periodYear = new Date().getFullYear();
    let periodMonth = new Date().getMonth() + 1;
    let localPath: string | undefined;
    let sizeBytes = 0;
    let mimeType = 'application/pdf';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      title = String(form.get('title') || '');
      category = String(form.get('category') || 'OTHER');
      directory = String(form.get('directory') || 'INVOICE');
      periodYear = Number(form.get('periodYear')) || periodYear;
      periodMonth = Number(form.get('periodMonth')) || periodMonth;
      const file = form.get('file');
      if (file instanceof File && file.size > 0) {
        localPath = await saveDocumentPdf(file, directory, periodYear, periodMonth);
        sizeBytes = file.size;
        mimeType = 'application/pdf';
      }
    } else {
      const body = await req.json();
      title = body.title;
      category = body.category || 'OTHER';
      directory = body.directory || 'INVOICE';
      periodYear = Number(body.periodYear) || periodYear;
      periodMonth = Number(body.periodMonth) || periodMonth;
    }

    if (!title.trim()) throw new AppError('VALIDATION_ERROR', 'Title is required');
    if (!localPath) throw new AppError('INVALID_FILE', 'Choose a PDF to save in the selected directory');

    const doc = await prisma.document.create({
      data: {
        storeId: user.storeId,
        uploadedById: user.id,
        title: title.trim(),
        category: asCategory(category),
        directory: (directory || 'OTHERS') as DocumentDirectory,
        periodYear,
        periodMonth,
        mimeType,
        sizeBytes,
        localPath,
        employeeId: user.role === 'STAFF' ? user.id : null
      }
    });
    await writeAudit({
      userId: user.id,
      storeId: user.storeId,
      action: 'DOCUMENT_UPLOAD',
      entity: 'Document',
      entityId: doc.id
    });
    return ok(doc, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
