/** Server-side SKU / barcode helpers (keep in sync with apps/web retailCodes). */

export const STORE_EAN_PREFIX = "890";

export function normalizeBarcode(raw: string): string {
  return String(raw || "").replace(/\s+/g, "").trim();
}

export function ean13CheckDigit(twelveDigits: string): string {
  const d = twelveDigits.replace(/\D/g, "").slice(0, 12).padStart(12, "0");
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = Number(d[i]);
    sum += i % 2 === 0 ? n : n * 3;
  }
  return String((10 - (sum % 10)) % 10);
}

export function ean13FromSerial(serial: number): string {
  const n = Math.max(1, Math.min(999999999, Math.floor(serial)));
  const twelve = `${STORE_EAN_PREFIX}${String(n).padStart(9, "0")}`;
  return twelve + ean13CheckDigit(twelve);
}

export function parseStoreEanSerial(barcode: string): number | null {
  const b = normalizeBarcode(barcode);
  if (!/^\d{13}$/.test(b) || !b.startsWith(STORE_EAN_PREFIX)) return null;
  const body = b.slice(3, 12);
  if (!/^\d{9}$/.test(body)) return null;
  if (ean13FromSerial(Number(body)) !== b) return null;
  return Number(body);
}

export function nextSerialEan13(
  existingBarcodes: Array<string | null | undefined>,
  excludeBarcode?: string | null,
): string {
  const exclude = normalizeBarcode(excludeBarcode || "");
  let max = 0;
  const used = new Set<string>();

  for (const raw of existingBarcodes) {
    const b = normalizeBarcode(String(raw || ""));
    if (!b) continue;
    if (exclude && b === exclude) continue;
    used.add(b);
    const serial = parseStoreEanSerial(b);
    if (serial != null) max = Math.max(max, serial);
  }

  let next = max + 1;
  for (let i = 0; i < 10000; i++) {
    const candidate = ean13FromSerial(next);
    if (!used.has(candidate)) return candidate;
    next += 1;
  }
  return ean13FromSerial(Date.now() % 1000000000 || 1);
}

export function ensureUniqueBarcode(
  preferred: string | null | undefined,
  existingBarcodes: Array<string | null | undefined>,
  excludeBarcode?: string | null,
): string {
  const want = normalizeBarcode(preferred || "");
  const exclude = normalizeBarcode(excludeBarcode || "");
  const used = new Set(
    existingBarcodes
      .map((b) => normalizeBarcode(String(b || "")))
      .filter((b) => b && b !== exclude),
  );
  if (want && !used.has(want)) return want;
  return nextSerialEan13(existingBarcodes, excludeBarcode);
}
