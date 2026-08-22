import fs from 'fs/promises';
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { pdfSafe } from '@/lib/pdf';
import { isAllowedPdfRemoteUrl, resolvePublicUploadPath } from '@/lib/safe-files';

const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

export type DocumentExportFilters = {
  year?: number;
  month?: number;
  directory?: string;
  category?: string;
};

async function loadDocuments(storeId?: string | null, filters?: DocumentExportFilters) {
  return prisma.document.findMany({
    where: {
      ...(storeId ? { storeId } : {}),
      ...(filters?.year ? { periodYear: filters.year } : {}),
      ...(filters?.month ? { periodMonth: filters.month } : {}),
      ...(filters?.directory ? { directory: filters.directory as never } : {}),
      ...(filters?.category ? { category: filters.category as never } : {})
    },
    include: { uploadedBy: true },
    orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { createdAt: 'asc' }],
    take: 2000
  });
}

function directoryLabel(directory?: string) {
  if (!directory) return 'All_Documents';
  if (directory === 'INVOICE') return 'Invoices';
  if (directory === 'EMPLOYEE') return 'Employee_Documents';
  if (directory === 'CONFUSED') return 'Confused_Documents';
  if (directory === 'OTHERS') return 'Other_Documents';
  return `${directory}_Documents`;
}

export function documentsExportFilename(filters?: DocumentExportFilters, ext = 'pdf') {
  const dir = directoryLabel(filters?.directory);
  const month =
    filters?.month && filters?.year
      ? `${MONTH_NAMES[filters.month] || filters.month}_${filters.year}`
      : 'All_Time';
  return `${dir}_${month}.${ext}`;
}

function localFilePath(localPath: string) {
  return resolvePublicUploadPath(localPath);
}

async function readPdfBytes(doc: {
  localPath?: string | null;
  driveUrl?: string | null;
}): Promise<Uint8Array | null> {
  if (doc.localPath?.startsWith('http')) {
    if (!isAllowedPdfRemoteUrl(doc.localPath)) return null;
    const res = await fetch(doc.localPath);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  }
  if (doc.localPath) {
    try {
      const buf = await fs.readFile(localFilePath(doc.localPath));
      return new Uint8Array(buf);
    } catch {
      /* try url next */
    }
  }
  if (doc.driveUrl) {
    if (!isAllowedPdfRemoteUrl(doc.driveUrl)) return null;
    const res = await fetch(doc.driveUrl);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  }
  return null;
}

async function addMissingPage(merged: PDFDocument, title: string, reason: string) {
  const page = merged.addPage([595, 842]);
  const font = await merged.embedFont(StandardFonts.Helvetica);
  page.drawText('THE OUDS - Document could not be included', {
    x: 48,
    y: 760,
    size: 14,
    font,
    color: rgb(0, 0, 0)
  });
  page.drawText(pdfSafe(title).slice(0, 90), { x: 48, y: 730, size: 12, font, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(pdfSafe(reason).slice(0, 90), { x: 48, y: 708, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
}

export async function countMatchingDocuments(
  storeId?: string | null,
  filters?: DocumentExportFilters
) {
  const rows = await loadDocuments(storeId, filters);
  return {
    count: rows.length,
    filename: documentsExportFilename(filters)
  };
}

export async function buildDocumentsExcel(
  storeId?: string | null,
  filters?: DocumentExportFilters
) {
  const rows = await loadDocuments(storeId, filters);
  if (!rows.length) {
    throw new AppError('NOT_FOUND', 'No PDF documents found for the selected filters.', 404);
  }
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Documents');
  sheet.columns = [
    { header: 'Title', key: 'title', width: 36 },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Directory', key: 'directory', width: 14 },
    { header: 'Month', key: 'month', width: 12 },
    { header: 'Uploaded By', key: 'by', width: 20 },
    { header: 'Date', key: 'date', width: 14 }
  ];
  for (const d of rows) {
    sheet.addRow({
      title: d.title,
      category: d.category,
      directory: d.directory,
      month: d.periodYear && d.periodMonth ? `${d.periodMonth}/${d.periodYear}` : '',
      by: d.uploadedBy?.name || '',
      date: new Date(d.createdAt).toLocaleDateString('en-GB')
    });
  }
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return {
    buffer: await workbook.xlsx.writeBuffer(),
    filename: documentsExportFilename(filters, 'xlsx')
  };
}

export async function buildDocumentsPdf(
  storeId?: string | null,
  filters?: DocumentExportFilters
) {
  const rows = await loadDocuments(storeId, filters);
  if (!rows.length) {
    throw new AppError('NOT_FOUND', 'No PDF documents found for the selected filters.', 404);
  }

  const merged = await PDFDocument.create();
  let copied = 0;
  for (const row of rows) {
    const bytes = await readPdfBytes(row);
    if (!bytes) {
      await addMissingPage(merged, row.title, 'Original file was not found on disk. The uploaded file was not changed.');
      continue;
    }
    try {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
      copied += 1;
    } catch {
      await addMissingPage(merged, row.title, 'This file could not be merged. The original upload is unchanged.');
    }
  }

  if (!copied && merged.getPageCount() === 0) {
    throw new AppError('NOT_FOUND', 'No PDF documents found for the selected filters.', 404);
  }

  const buffer = Buffer.from(await merged.save());
  return { buffer, filename: documentsExportFilename(filters), count: rows.length };
}
