export const PERFUME_SIZES_ML = [5, 10, 15, 20, 30, 50, 75, 100, 125, 150, 200];

export const PERFUME_SIZE_OPTIONS = PERFUME_SIZES_ML.map((ml) => `${ml}ml`);

export function parseMl(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  if (!raw) return null;
  const n = Number.parseFloat(raw.replace(/ml.*$/i, ''));
  if (!Number.isFinite(n) || n <= 0 || n > 20000) return null;
  return Number.isInteger(n) ? n : Math.round(n * 10) / 10;
}

export function normalizePerfumeSize(value) {
  const ml = parseMl(value);
  return ml == null ? '100ml' : `${ml}ml`;
}

export function invoiceItemSize(item) {
  return normalizePerfumeSize(item?.size || item?.product?.size);
}
