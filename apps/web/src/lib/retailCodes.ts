/** SKU / barcode helpers for admin retail modules */

export function nextSkuSequence(existingSkus: string[], prefix = 'EV'): string {
  let max = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  for (const sku of existingSkus) {
    const m = String(sku || '').match(re);
    if (m) max = Math.max(max, Number(m[1]) || 0);
  }
  return `${prefix}-${String(max + 1).padStart(6, '0')}`;
}

/** EAN-13 check digit */
export function ean13CheckDigit(twelveDigits: string): string {
  const d = twelveDigits.replace(/\D/g, '').slice(0, 12).padStart(12, '0');
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = Number(d[i]);
    sum += i % 2 === 0 ? n : n * 3;
  }
  return String((10 - (sum % 10)) % 10);
}

/** GS1-style prefix used for Epic Vanskap auto barcodes (Bangladesh common retail). */
export const STORE_EAN_PREFIX = '890';

/**
 * Build a valid EAN-13 from a serial number (1…999999999).
 * Format: 890 + 9-digit serial + check digit.
 */
export function ean13FromSerial(serial: number): string {
  const n = Math.max(1, Math.min(999999999, Math.floor(serial)));
  const twelve = `${STORE_EAN_PREFIX}${String(n).padStart(9, '0')}`;
  return twelve + ean13CheckDigit(twelve);
}

/** Parse serial from our auto EAN-13 barcodes; returns null if not ours. */
export function parseStoreEanSerial(barcode: string): number | null {
  const b = normalizeBarcode(barcode);
  if (!/^\d{13}$/.test(b)) return null;
  if (!b.startsWith(STORE_EAN_PREFIX)) return null;
  const body = b.slice(3, 12);
  if (!/^\d{9}$/.test(body)) return null;
  const expected = ean13FromSerial(Number(body));
  if (expected !== b) return null;
  return Number(body);
}

/**
 * Next unique serial EAN-13 based on existing product barcodes.
 * Always increments past the highest store serial already used.
 */
export function nextSerialEan13(
  existingBarcodes: Array<string | null | undefined>,
  excludeBarcode?: string | null,
): string {
  const exclude = normalizeBarcode(excludeBarcode || '');
  let max = 0;
  const used = new Set<string>();

  for (const raw of existingBarcodes) {
    const b = normalizeBarcode(String(raw || ''));
    if (!b) continue;
    if (exclude && b === exclude) continue;
    used.add(b);
    const serial = parseStoreEanSerial(b);
    if (serial != null) max = Math.max(max, serial);
  }

  let next = max + 1;
  // Safety: skip any accidental collision with non-store barcodes we might generate
  for (let i = 0; i < 10000; i++) {
    const candidate = ean13FromSerial(next);
    if (!used.has(candidate)) return candidate;
    next += 1;
  }
  // Extremely unlikely fallback
  return ean13FromSerial(Date.now() % 1000000000 || 1);
}

/** @deprecated Prefer nextSerialEan13 for unique serial barcodes */
export function generateEan13(seed?: string | number): string {
  const digits = String(seed ?? Date.now()).replace(/\D/g, '');
  const serial = Number(digits.slice(-9)) || 1;
  return ean13FromSerial(serial);
}

export function normalizeBarcode(raw: string): string {
  return String(raw || '').replace(/\s+/g, '').trim();
}

export function isValidBarcode(raw: string): boolean {
  const b = normalizeBarcode(raw);
  if (b.length < 6 || b.length > 32) return false;
  return /^[A-Za-z0-9\-]+$/.test(b);
}

/** Ensure barcode is unique among products; regenerates serial if needed. */
export function ensureUniqueBarcode(
  preferred: string | null | undefined,
  existingBarcodes: Array<string | null | undefined>,
  excludeBarcode?: string | null,
): string {
  const want = normalizeBarcode(preferred || '');
  const exclude = normalizeBarcode(excludeBarcode || '');
  const used = new Set(
    existingBarcodes
      .map((b) => normalizeBarcode(String(b || '')))
      .filter((b) => b && b !== exclude),
  );
  if (want && !used.has(want)) return want;
  return nextSerialEan13(existingBarcodes, excludeBarcode);
}
