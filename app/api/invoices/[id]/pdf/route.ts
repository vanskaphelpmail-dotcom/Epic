import fs from 'fs';
import { prisma } from '@/lib/prisma';
import { AppError, errorResponse } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { formatGBP } from '@/lib/money';
import { getLogoFilePath, getRefundQrFilePath, resolveStoreBrand } from '@/lib/store-branding';
import { invoiceItemSize } from '@/lib/perfume-sizes';
import { assertSameStore } from '@/lib/store-access';
import { createPdfDocument, drawPdfText, finishPdf, pdfFileHeaders } from '@/lib/pdf';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAnyPermission('ORDER_PRINT', 'POS_ACCESS', 'SALES_VIEW');
    const { id } = await ctx.params;
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { items: { include: { product: { select: { size: true } } } }, store: true, staff: true, customer: true }
    });
    if (!sale) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    assertSameStore(user, sale.storeId, 'Invoice not found');

    const brand = resolveStoreBrand(sale.store);
    const discountPct =
      sale.discount > 0
        ? sale.discountPercent || Math.round((sale.discount / Math.max(sale.subtotal, 0.01)) * 1000) / 10
        : 0;

    const mm = 72 / 25.4;
    const width = 80 * mm;
    const height = Math.max(400, 220 + sale.items.length * 28 + 180);
    const doc = createPdfDocument({ size: [width, height], margin: 10 });

    const logoPath = getLogoFilePath();
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, (width - 48) / 2, 8, { width: 48, height: 48, fit: [48, 48] });
        doc.y = 60;
      } catch {
        /* logo optional */
      }
    }
    doc.fontSize(11);
    drawPdfText(doc, 'THE OUDS', undefined, undefined, { align: 'center', bold: true });
    doc.fontSize(7);
    drawPdfText(doc, brand.address, undefined, undefined, { align: 'center' });
    drawPdfText(doc, brand.phone, undefined, undefined, { align: 'center' });
    drawPdfText(doc, brand.website, undefined, undefined, { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(8);
    drawPdfText(doc, `Invoice   ${sale.invoiceNumber}`);
    drawPdfText(doc, `Date      ${new Date(sale.saleDate).toLocaleString('en-GB')}`);
    drawPdfText(doc, `Staff     ${sale.staff?.name || ''}`);
    drawPdfText(doc, `Customer  ${sale.customer?.name || 'Walk-in'}`);
    if (sale.customer?.phone) drawPdfText(doc, `Mobile    ${sale.customer.phone}`);
    if (sale.customer?.companyName) drawPdfText(doc, `Company   ${sale.customer.companyName}`);
    if (sale.customer?.city) drawPdfText(doc, `City      ${sale.customer.city}`);
    if (sale.customer?.location) drawPdfText(doc, `Location  ${sale.customer.location}`);
    doc.moveDown(0.25);
    doc.moveTo(10, doc.y).lineTo(width - 10, doc.y).stroke();
    doc.moveDown(0.2);
    doc.fontSize(7);
    drawPdfText(doc, 'PRODUCT', 10, doc.y, { continued: true, width: 110, bold: true });
    drawPdfText(doc, 'QTY', 120, doc.y, { continued: true, width: 24, align: 'right', bold: true });
    drawPdfText(doc, 'TOTAL', 144, doc.y, { width: width - 154, align: 'right', bold: true });
    doc.moveTo(10, doc.y + 2).lineTo(width - 10, doc.y + 2).stroke();
    doc.moveDown(0.35);
    doc.fontSize(8);
    for (const item of sale.items) {
      drawPdfText(doc, item.name, 10, doc.y, { width: width - 20 });
      doc.fontSize(7);
      drawPdfText(doc, `Size ${invoiceItemSize(item)}`);
      doc.fontSize(8);
      drawPdfText(doc, `${item.quantity}  ${formatGBP(item.lineTotal)}`, undefined, undefined, { align: 'right' });
      doc.moveDown(0.15);
    }
    doc.moveTo(10, doc.y).lineTo(width - 10, doc.y).stroke();
    doc.moveDown(0.3);
    drawPdfText(doc, `Subtotal        ${formatGBP(sale.subtotal)}`);
    if (sale.discount > 0) {
      drawPdfText(doc, `Discount${discountPct ? ` (${discountPct}%)` : ''}     ${formatGBP(sale.discount)}`);
    }
    drawPdfText(doc, `VAT             ${formatGBP(sale.tax)}`);
    doc.fontSize(11);
    drawPdfText(doc, `Total           ${formatGBP(sale.total)}`, undefined, undefined, { bold: true });
    doc.fontSize(8);
    drawPdfText(
      doc,
      `${sale.paymentStatus === 'UNPAID' ? 'Due' : 'Paid'}  ${formatGBP(sale.cashReceived ?? (sale.paymentStatus === 'UNPAID' ? 0 : sale.total))}`
    );
    doc.moveDown(0.4);
    drawPdfText(doc, 'Thank you for shopping with us.', undefined, undefined, { align: 'center' });
    const qrPath = getRefundQrFilePath();
    if (fs.existsSync(qrPath)) {
      try {
        const qrSize = 64;
        doc.image(qrPath, (width - qrSize) / 2, doc.y + 4, { width: qrSize, height: qrSize });
        doc.y += qrSize + 8;
      } catch {
        /* qr optional */
      }
    }
    doc.fontSize(7);
    drawPdfText(doc, 'Refund policy', undefined, undefined, { align: 'center' });

    const pdf = await finishPdf(doc);
    return new Response(new Uint8Array(pdf), {
      headers: pdfFileHeaders(`${sale.invoiceNumber}.pdf`)
    });
  } catch (error) {
    return errorResponse(error);
  }
}
