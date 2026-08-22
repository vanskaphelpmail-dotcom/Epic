import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { buildStructuredPdf } from '../lib/report-export';
import {
  createPdfDocument,
  drawPdfText,
  finishPdf,
  isPdfBuffer,
  pdfSafe,
  splitScriptRuns,
  unicodeFontsAvailable
} from '../lib/pdf';

test('pdfSafe never emits WinAnsi-unsafe characters', () => {
  const out = pdfSafe('Hello — বাংলা “quotes” € £ \u0000');
  for (const ch of out) {
    assert.ok(ch.charCodeAt(0) <= 255);
  }
});

test('splitScriptRuns separates Bangla and Latin', () => {
  const runs = splitScriptRuns('Invoice রহিম Rahman');
  assert.ok(runs.some((r) => r.script === 'bn'));
  assert.ok(runs.some((r) => r.script === 'lat'));
});

test('invoice-style PDF generates with English, Bangla, empty and long text', async () => {
  const doc = createPdfDocument({ size: 'A4', margin: 36 });
  drawPdfText(doc, 'THE OUDS', undefined, undefined, { align: 'center', bold: true });
  drawPdfText(doc, '');
  drawPdfText(doc, 'Customer  রহিম আহমেদ');
  drawPdfText(doc, 'Special chars <>& "quotes" — – … € £');
  drawPdfText(doc, 'Long '.repeat(400), undefined, undefined, { width: 500 });
  const buffer = await finishPdf(doc);
  assert.ok(isPdfBuffer(buffer));
  assert.ok(buffer.length > 500);
  const parsed = await PDFDocument.load(buffer);
  assert.ok(parsed.getPageCount() >= 1);
  if (unicodeFontsAvailable()) {
    const raw = buffer.toString('latin1');
    assert.match(raw, /OudsBengali|NotoSansBengali|Identity-H/);
  }
});

test('report PDF handles empty, unicode, multi-page and missing fields', async () => {
  const empty = await buildStructuredPdf({
    filename: 'empty.pdf',
    generatedBy: 'রহিম Admin',
    q: 'বাংলা',
    filters: { status: 'PAID' },
    data: {
      type: 'sales',
      title: 'Sales report · বাংলা',
      periodLabel: '1–31 Aug 2026',
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'amount', label: 'Amount', kind: 'money' }
      ],
      rows: [],
      summaries: [{ label: 'Total', value: 0 }],
      totalAmount: 0
    }
  });
  assert.ok(isPdfBuffer(Buffer.from(empty.buffer)));

  const rows = Array.from({ length: 80 }, (_, i) => ({
    name: i % 5 === 0 ? `Product বাংলা ${i}` : `Product ${i}`,
    amount: i * 1.5
  }));
  const full = await buildStructuredPdf({
    filename: 'sales.pdf',
    generatedBy: 'Yasin',
    data: {
      type: 'sales',
      title: 'Sales report',
      periodLabel: 'August 2026',
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'amount', label: 'Amount', kind: 'money' },
        { key: 'missing', label: 'Notes' }
      ],
      rows,
      summaries: [
        { label: 'Orders', value: 80 },
        { label: 'Total amount', value: 1000 }
      ],
      totalAmount: 1000
    }
  });
  const parsed = await PDFDocument.load(full.buffer);
  assert.ok(parsed.getPageCount() >= 2);
  assert.equal(full.contentType, 'application/pdf');
});
