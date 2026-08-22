import { formatGBP } from '@/lib/money';

export function buildInvoiceShareText(sale: {
  invoiceNumber: string;
  total: number;
  store?: { name?: string | null; phone?: string | null } | null;
  customer?: { name?: string | null } | null;
}) {
  const store = sale.store?.name || 'The Ouds';
  const customer = sale.customer?.name || 'Customer';
  return `${store} invoice ${sale.invoiceNumber} for ${customer}. Total ${formatGBP(sale.total)}. www.theouds.co.uk — Thank you for your purchase.`;
}

export function whatsappShareUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function mailtoShareUrl(text: string, invoiceNumber: string) {
  return `mailto:?subject=${encodeURIComponent(`Invoice ${invoiceNumber}`)}&body=${encodeURIComponent(text)}`;
}
