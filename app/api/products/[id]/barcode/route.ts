import { collectPdfBuffer, createPdfDocument, drawPdfText, pdfFileHeaders } from '@/lib/pdf';
import { errorResponse, AppError } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import { getProductById } from '@/services/product.service';
import { resolveStoreBrand } from '@/lib/store-branding';
import { assertSameStore } from '@/lib/store-access';

/** Thermal barcode / price label size (common sticky label): 50mm × 30mm */
const LABEL_W_MM = 50;
const LABEL_H_MM = 30;
const MM_TO_PT = 72 / 25.4;

async function renderBarcodePng(text: string, opts?: { includetext?: boolean; height?: number; scale?: number }) {
  const mod = (await import('bwip-js')) as unknown as {
    default?: { toBuffer: (opts: Record<string, unknown>) => Promise<Buffer> };
    toBuffer?: (opts: Record<string, unknown>) => Promise<Buffer>;
  };
  const bwip = mod.default || mod;
  if (typeof bwip.toBuffer !== 'function') {
    throw new AppError('INTERNAL_ERROR', 'Barcode renderer unavailable', 500);
  }
  return bwip.toBuffer({
    bcid: 'code128',
    text,
    scale: opts?.scale ?? 2,
    height: opts?.height ?? 10,
    includetext: opts?.includetext ?? false,
    textxalign: 'center'
  });
}

function escapeHtml(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildLabelHtml(
  product: { name: string; barcode: string },
  qty: number,
  dataUri: string,
  productId: string,
  shop: { name: string; city: string }
) {
  const shopName = escapeHtml(shop.name);
  const city = escapeHtml(shop.city);
  const code = escapeHtml(product.barcode);
  const labels = Array.from({ length: qty }, (_, i) => `
    <div class="label">
      <div class="brand">${shopName}</div>
      <div class="city">${city}</div>
      <img src="${dataUri}" alt="${code}" />
      <div class="code">${code}</div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Barcode labels · ${code} × ${qty}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&display=swap" rel="stylesheet" />
  <style>
    @page {
      size: ${LABEL_W_MM}mm ${LABEL_H_MM}mm;
      margin: 0;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      font-family: Inter, system-ui, sans-serif;
      background: #f3f4f6;
      color: #000;
    }
    .toolbar {
      max-width: 720px;
      margin: 0 auto 16px;
      padding: 14px 16px;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
    }
    .toolbar h1 {
      margin: 0;
      font: 700 16px/1.3 Inter, sans-serif;
    }
    .toolbar p {
      margin: 2px 0 0;
      font: 500 13px/1.3 Inter, sans-serif;
      color: #6b7280;
    }
    .toolbar .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .toolbar button, .toolbar a {
      font: 600 13px/1 Inter, sans-serif;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid #111;
      background: #111;
      color: #fff;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }
    .toolbar button.secondary, .toolbar a.secondary {
      background: #fff;
      color: #111;
    }
    .sheet {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: center;
      max-width: 900px;
      margin: 0 auto;
    }
    .label {
      width: ${LABEL_W_MM}mm;
      height: ${LABEL_H_MM}mm;
      background: #fff;
      border: 1px dashed #c7cbd1;
      border-radius: 2px;
      padding: 1.6mm 2mm 1.4mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
    }
    .brand {
      font: 700 7px/1 Inter, sans-serif;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .city {
      font: 600 7.5px/1 Inter, sans-serif;
      color: #111;
      text-align: center;
    }
    .label img {
      width: 42mm;
      height: 9mm;
      object-fit: contain;
    }
    .code {
      font: 600 7.5px/1 Inter, sans-serif;
      letter-spacing: 0.04em;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .toolbar { display: none !important; }
      .sheet { gap: 0; max-width: none; }
      .label {
        border: none;
        border-radius: 0;
        margin: 0;
        width: ${LABEL_W_MM}mm;
        height: ${LABEL_H_MM}mm;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <div>
      <h1>Thermal barcode labels · ${qty} copy${qty === 1 ? '' : 'ies'}</h1>
      <p>Shop · city · barcode only · ${LABEL_W_MM}×${LABEL_H_MM}mm · ${code}</p>
    </div>
    <div class="actions">
      <button class="secondary" type="button" onclick="window.close()">Close</button>
      <a class="secondary" href="/api/products/${productId}/barcode?format=pdf&qty=${qty}">Download PDF</a>
      <button type="button" onclick="window.print()">Print labels</button>
    </div>
  </div>
  <div class="sheet">${labels}</div>
</body>
</html>`;
}

async function buildLabelPdf(
  product: { barcode: string },
  qty: number,
  png: Buffer,
  shop: { name: string; city: string }
) {
  const width = LABEL_W_MM * MM_TO_PT;
  const height = LABEL_H_MM * MM_TO_PT;
  const doc = createPdfDocument({
    size: [width, height],
    margin: 4,
    autoFirstPage: false
  });
  const done = collectPdfBuffer(doc);

  for (let i = 0; i < qty; i += 1) {
    doc.addPage({ size: [width, height], margin: 4 });
    const contentW = width - 8;

    doc.fontSize(8).fillColor('#000');
    drawPdfText(doc, shop.name.toUpperCase(), 4, 6, { width: contentW, align: 'center', bold: true });
    doc.fontSize(7);
    drawPdfText(doc, shop.city, 4, 18, { width: contentW, align: 'center' });

    const imgW = contentW * 0.92;
    const imgH = 28;
    const imgX = 4 + (contentW - imgW) / 2;
    doc.image(png, imgX, 30, { width: imgW, height: imgH, fit: [imgW, imgH] });

    doc.fontSize(8);
    drawPdfText(doc, product.barcode, 4, height - 14, { width: contentW, align: 'center', bold: true });
  }

  doc.end();
  return done;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAnyPermission('PRODUCT_VIEW', 'POS_ACCESS', 'INVENTORY_VIEW');
    const { id } = await ctx.params;
    const product = await getProductById(id, user.storeId);
    const { searchParams } = new URL(req.url);
    const format = (searchParams.get('format') || 'label').toLowerCase();
    const qty = Math.min(200, Math.max(1, Number(searchParams.get('qty') || 1) || 1));

    if (!product.barcode) {
      throw new AppError('VALIDATION_ERROR', 'Product has no barcode');
    }

    const png = await renderBarcodePng(product.barcode, {
      includetext: false,
      height: 10,
      scale: 2
    });
    const shop = {
      name: resolveStoreBrand(product.store).displayName,
      city: product.store?.city || 'Cardiff'
    };

    if (format === 'pdf') {
      const pdf = await buildLabelPdf(product, qty, Buffer.from(png), shop);
      return new Response(new Uint8Array(pdf), {
        headers: pdfFileHeaders(`barcode-${product.barcode}-x${qty}.pdf`)
      });
    }

    if (format === 'png') {
      return new Response(Buffer.from(png), {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `inline; filename="barcode-${product.barcode}.png"`
        }
      });
    }

    // Default: thermal label HTML preview (print-ready Code 128)
    const dataUri = `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
    const html = buildLabelHtml(product, qty, dataUri, id, shop);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
