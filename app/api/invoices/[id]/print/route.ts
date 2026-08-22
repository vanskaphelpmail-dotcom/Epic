import { prisma } from '@/lib/prisma';
import { AppError, errorResponse } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { formatGBP } from '@/lib/money';
import {
  getLogoDataUri,
  getRefundQrDataUri,
  resolveStoreBrand
} from '@/lib/store-branding';
import { invoiceItemSize } from '@/lib/perfume-sizes';
import { escapeHtml } from '@/lib/html';
import { assertSameStore } from '@/lib/store-access';

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
    const logo = getLogoDataUri();
    const qr = getRefundQrDataUri();
    const discountPct =
      sale.discount > 0
        ? sale.discountPercent || Math.round((sale.discount / Math.max(sale.subtotal, 0.01)) * 1000) / 10
        : 0;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(sale.invoiceNumber)}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    * { box-sizing: border-box; }
    html, body { width: 80mm; margin: 0; background: #fff; color: #000; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      width: 80mm;
      padding: 2mm 3mm 6mm;
    }
    .logo { display: block; width: 18mm; height: 18mm; object-fit: contain; margin: 0 auto 3mm; }
    .brand { text-align: center; font-size: 13px; font-weight: 700; letter-spacing: 0.14em; margin: 0 0 2mm; }
    .muted { text-align: center; margin: 0; font-size: 9px; }
    .meta { margin: 4mm 0 2mm; }
    .row { display: flex; justify-content: space-between; gap: 4px; margin: 1px 0; }
    table { width: 100%; border-collapse: collapse; margin: 2mm 0; }
    th { text-align: left; font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase; border-bottom: 1px solid #000; padding: 0 0 2px; }
    td { padding: 3px 0; border-bottom: 1px solid #eee; vertical-align: top; }
    th:nth-child(2), td:nth-child(2),
    th:nth-child(3), td:nth-child(3) { text-align: right; white-space: nowrap; }
    .size { display: block; font-size: 8px; }
    .totals { border-top: 1px solid #000; padding-top: 2mm; margin-top: 1mm; }
    .total { font-weight: 700; font-size: 13px; margin-top: 2mm; padding-top: 1mm; border-top: 1px solid #000; }
    .thanks { text-align: center; margin: 4mm 0 2mm; font-size: 10px; }
    .qr { text-align: center; }
    .qr img { width: 22mm; height: 22mm; }
    .actions { text-align: center; margin-bottom: 3mm; }
    .actions button { font: 600 12px Arial; padding: 6px 10px; border: 1px solid #111; background: #111; color: #fff; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="actions no-print"><button onclick="window.print()">Print</button></div>
  ${logo ? `<img class="logo" src="${logo}" alt="" />` : ''}
  <div class="brand">THE OUDS</div>
  <p class="muted">${escapeHtml(brand.address)}</p>
  <p class="muted">${escapeHtml(brand.phone)}</p>
  <p class="muted">${escapeHtml(brand.website)}</p>
  <div class="meta">
    <div class="row"><span>Invoice</span><span>${escapeHtml(sale.invoiceNumber)}</span></div>
    <div class="row"><span>Date</span><span>${escapeHtml(new Date(sale.saleDate).toLocaleString('en-GB'))}</span></div>
    <div class="row"><span>Staff</span><span>${escapeHtml(sale.staff?.name || '')}</span></div>
    <div class="row"><span>Customer</span><span>${escapeHtml(sale.customer?.name || 'Walk-in')}</span></div>
    ${sale.customer?.phone ? `<div class="row"><span>Mobile</span><span>${escapeHtml(sale.customer.phone)}</span></div>` : ''}
    ${sale.customer?.companyName ? `<div class="row"><span>Company</span><span>${escapeHtml(sale.customer.companyName)}</span></div>` : ''}
    ${sale.customer?.city ? `<div class="row"><span>City</span><span>${escapeHtml(sale.customer.city)}</span></div>` : ''}
    ${sale.customer?.location ? `<div class="row"><span>Location</span><span>${escapeHtml(sale.customer.location)}</span></div>` : ''}
  </div>
  <table>
    <thead>
      <tr><th>Product</th><th>Qty</th><th>Total</th></tr>
    </thead>
    <tbody>
      ${sale.items
        .map(
          (item) => `<tr>
            <td>${escapeHtml(item.name)}<span class="size">Size ${escapeHtml(invoiceItemSize(item))}</span></td>
            <td>${item.quantity}</td>
            <td>${formatGBP(item.lineTotal)}</td>
          </tr>`
        )
        .join('')}
    </tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${formatGBP(sale.subtotal)}</span></div>
    ${sale.discount > 0 ? `<div class="row"><span>Discount${discountPct ? ` (${discountPct}%)` : ''}</span><span>${formatGBP(sale.discount)}</span></div>` : ''}
    <div class="row"><span>VAT</span><span>${formatGBP(sale.tax)}</span></div>
    <div class="row total"><span>Total</span><span>${formatGBP(sale.total)}</span></div>
    <div class="row"><span>${sale.paymentStatus === 'UNPAID' ? 'Due' : 'Paid'}</span><span>${formatGBP(sale.cashReceived ?? (sale.paymentStatus === 'UNPAID' ? 0 : sale.total))}</span></div>
  </div>
  <p class="thanks">Thank you for shopping with us.</p>
  <div class="qr">
    ${qr ? `<img src="${qr}" alt="" />` : ''}
    <p class="muted">Refund policy</p>
  </div>
  <script>window.print()</script>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
