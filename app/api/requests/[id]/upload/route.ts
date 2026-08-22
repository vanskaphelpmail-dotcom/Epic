import { DocumentCategory, DocumentDirectory } from '@prisma/client';
import { errorResponse, ok, AppError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/services/auth.service';
import { attachRequestFile, filingPeriod, getRequest } from '@/services/request.service';
import { saveEmployeeRequestPdf } from '@/lib/uploads';
import { requestTypeLabel } from '@/lib/request-types';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== 'ADMIN' && !(user.permissions || []).includes('SALARY_VIEW')) {
      throw new AppError('FORBIDDEN', 'Only admin can upload the official PDF', 403);
    }
    const { id } = await params;
    const existing = await getRequest(user, id);
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new AppError('INVALID_FILE', 'Choose a PDF');
    const period = filingPeriod(existing);
    const year = period.year;
    const monthName = MONTHS[period.month - 1] || 'Document';
    const emp = existing.employee?.employeeId || 'EMP';
    const typeSlug = requestTypeLabel(existing.type).replace(/\s+/g, '-');
    const includeMonth = existing.type === 'PAYSLIP' || existing.type === 'SALARY_CERTIFICATE';
    const fileName = includeMonth
      ? `${emp}_${typeSlug}_${monthName}_${year}.pdf`
      : `${emp}_${typeSlug}_${year}.pdf`;
    const relative = `EMPLOYEE/${year}/${monthName}/${typeSlug}/${fileName}`;
    const fileUrl = await saveEmployeeRequestPdf(file, relative);
    let documentId: string | undefined;
    if (user.storeId) {
      const doc = await prisma.document.create({
        data: {
          storeId: user.storeId,
          uploadedById: user.id,
          title: fileName,
          category: DocumentCategory.LETTER,
          directory: DocumentDirectory.EMPLOYEE,
          periodYear: year,
          periodMonth: period.month,
          mimeType: 'application/pdf',
          sizeBytes: file.size,
          status: 'APPROVED',
          employeeId: existing.employeeId,
          localPath: fileUrl
        }
      });
      documentId = doc.id;
    }
    const row = await attachRequestFile({
      actor: user,
      id,
      fileUrl,
      fileName,
      fileSize: file.size,
      documentId
    });
    return ok(row);
  } catch (error) {
    return errorResponse(error);
  }
}
