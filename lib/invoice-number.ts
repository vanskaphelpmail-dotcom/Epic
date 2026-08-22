export function nextInvoiceFromList(existing: string[], year = new Date().getFullYear()) {
  const prefix = `INV-${year}-`;
  let max = 0;
  for (const invoiceNumber of existing) {
    const suffix = String(invoiceNumber || '').slice(prefix.length);
    if (!/^\d+$/.test(suffix)) continue;
    const value = Number(suffix);
    if (Number.isFinite(value) && value > max) max = value;
  }
  return `${prefix}${String(max + 1).padStart(6, '0')}`;
}
