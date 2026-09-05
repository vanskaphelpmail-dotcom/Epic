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

export function generateEan13(seed?: string | number): string {
  const base = String(seed ?? Date.now())
    .replace(/\D/g, '')
    .slice(-11)
    .padStart(11, '0');
  // Use country-ish prefix 890 (BD common retail) + 11 digits → take 12 then check
  const twelve = (`890${base}`).slice(0, 12);
  return twelve + ean13CheckDigit(twelve);
}

export function normalizeBarcode(raw: string): string {
  return String(raw || '').replace(/\s+/g, '').trim();
}

export function isValidBarcode(raw: string): boolean {
  const b = normalizeBarcode(raw);
  if (b.length < 6 || b.length > 32) return false;
  return /^[A-Za-z0-9\-]+$/.test(b);
}
