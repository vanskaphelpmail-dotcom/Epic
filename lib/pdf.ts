import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts');

export const PDF_FONTS = {
  sans: path.join(FONT_DIR, 'NotoSans-Regular.ttf'),
  sansBold: path.join(FONT_DIR, 'NotoSans-Bold.ttf'),
  bengali: path.join(FONT_DIR, 'NotoSansBengali-Regular.ttf'),
  bengaliBold: path.join(FONT_DIR, 'NotoSansBengali-Bold.ttf')
} as const;

const BENGALI_RE = /[\u0980-\u09FF]/;

export function pdfSafe(text: string) {
  return String(text ?? '')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, ' ')
    .split('')
    .map((ch) => (ch.charCodeAt(0) <= 255 ? ch : ch.normalize('NFKD').replace(/[^\x00-\xFF]/g, '') || '?'))
    .join('');
}

export function hasPdfFont(filePath: string) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).size > 1024;
  } catch {
    return false;
  }
}

export function unicodeFontsAvailable() {
  return hasPdfFont(PDF_FONTS.sans) && hasPdfFont(PDF_FONTS.bengali);
}

export function registerAppFonts(doc: PDFKit.PDFDocument) {
  if (hasPdfFont(PDF_FONTS.sans)) doc.registerFont('OudsSans', PDF_FONTS.sans);
  if (hasPdfFont(PDF_FONTS.sansBold)) doc.registerFont('OudsSans-Bold', PDF_FONTS.sansBold);
  if (hasPdfFont(PDF_FONTS.bengali)) doc.registerFont('OudsBengali', PDF_FONTS.bengali);
  if (hasPdfFont(PDF_FONTS.bengaliBold)) doc.registerFont('OudsBengali-Bold', PDF_FONTS.bengaliBold);
  if (hasPdfFont(PDF_FONTS.sans)) doc.font('OudsSans');
}

export function createPdfDocument(options?: PDFKit.PDFDocumentOptions) {
  const doc = new PDFDocument(options);
  registerAppFonts(doc);
  return doc;
}

export function collectPdfBuffer(doc: PDFKit.PDFDocument) {
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

export function finishPdf(doc: PDFKit.PDFDocument) {
  const done = collectPdfBuffer(doc);
  doc.end();
  return done;
}

type ScriptKind = 'bn' | 'lat';

export function splitScriptRuns(text: string): Array<{ script: ScriptKind; text: string }> {
  const runs: Array<{ script: ScriptKind; text: string }> = [];
  let current = '';
  let script: ScriptKind | null = null;
  for (const ch of String(text ?? '')) {
    const next: ScriptKind = BENGALI_RE.test(ch) ? 'bn' : 'lat';
    if (script == null) {
      script = next;
      current = ch;
      continue;
    }
    if (next === script || /\s/.test(ch)) {
      current += ch;
      continue;
    }
    runs.push({ script, text: current });
    script = next;
    current = ch;
  }
  if (current && script) runs.push({ script, text: current });
  return runs;
}

function fontName(script: ScriptKind, bold?: boolean) {
  if (script === 'bn') {
    if (bold && hasPdfFont(PDF_FONTS.bengaliBold)) return 'OudsBengali-Bold';
    if (hasPdfFont(PDF_FONTS.bengali)) return 'OudsBengali';
  }
  if (bold && hasPdfFont(PDF_FONTS.sansBold)) return 'OudsSans-Bold';
  if (hasPdfFont(PDF_FONTS.sans)) return 'OudsSans';
  return bold ? 'Helvetica-Bold' : 'Helvetica';
}

export type PdfTextOptions = PDFKit.Mixins.TextOptions & { bold?: boolean };

function encodeForFont(text: string, font: string) {
  if (font.startsWith('Helvetica')) return pdfSafe(text);
  return String(text ?? '');
}

export function applyPdfFont(doc: PDFKit.PDFDocument, sample = '', bold = false) {
  const script: ScriptKind = BENGALI_RE.test(sample) ? 'bn' : 'lat';
  const name = fontName(script, bold);
  doc.font(name);
  return name;
}

export function drawPdfText(
  doc: PDFKit.PDFDocument,
  value: unknown,
  x?: number,
  y?: number,
  options?: PdfTextOptions
) {
  const raw = String(value ?? '');
  const { bold, ...rest } = options || {};
  const runs = splitScriptRuns(raw);
  const mixed = unicodeFontsAvailable() && runs.some((r) => r.script === 'bn') && runs.some((r) => r.script === 'lat' && r.text.trim());

  if (!mixed) {
    const sample = runs[0]?.text || raw;
    const font = applyPdfFont(doc, sample, bold);
    const text = encodeForFont(raw, font);
    if (typeof x === 'number' && typeof y === 'number') return doc.text(text, x, y, rest);
    return doc.text(text, rest);
  }

  runs.forEach((run, index) => {
    const font = applyPdfFont(doc, run.script === 'bn' ? 'অ' : 'A', bold);
    const text = encodeForFont(run.text, font);
    const opts = { ...rest, continued: index < runs.length - 1 };
    if (index === 0 && typeof x === 'number' && typeof y === 'number') doc.text(text, x, y, opts);
    else doc.text(text, opts);
  });
  return doc;
}

export function pdfTextHeight(doc: PDFKit.PDFDocument, value: unknown, options: PdfTextOptions) {
  const raw = String(value ?? '');
  const { bold, ...rest } = options;
  applyPdfFont(doc, raw, bold);
  const font = fontName(BENGALI_RE.test(raw) ? 'bn' : 'lat', bold);
  return doc.heightOfString(encodeForFont(raw, font), rest);
}

export function pdfFileHeaders(filename: string, contentType = 'application/pdf') {
  const asciiName = String(filename || 'document.pdf')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[^\x20-\x7E]/g, '-')
    .replace(/"/g, '');
  const encodedName = encodeURIComponent(filename || asciiName);
  return {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`
  };
}

export function isPdfBuffer(buffer: Buffer) {
  return buffer.length > 8 && buffer.subarray(0, 5).toString('utf8') === '%PDF-';
}
