/** Shared bKash full / partial payment helpers for checkout + orders. */

export type BkashPaymentType = 'full' | 'partial';

export type BkashPaymentMeta = {
  type: BkashPaymentType;
  paidAmount: number;
  orderTotal: number;
  dueOnDelivery: number;
};

/** Default advance per jersey (৳300 × quantity). */
export const BKASH_PARTIAL_PER_JERSEY_BDT = 300;

const TAG_RE = /\[BKASH:(full|partial):paid=(\d+):total=(\d+)\]/i;

export function buildBkashPaymentMeta(
  type: BkashPaymentType,
  paidAmount: number,
  orderTotal: number,
): BkashPaymentMeta {
  const paid = Math.max(0, Math.round(Number(paidAmount) || 0));
  const total = Math.max(0, Math.round(Number(orderTotal) || 0));
  return {
    type,
    paidAmount: paid,
    orderTotal: total,
    dueOnDelivery: type === 'partial' ? Math.max(0, total - paid) : 0,
  };
}

/** Total jersey units in cart/order (sums line quantities). */
export function cartJerseyCount(items: Array<{ quantity?: number }>): number {
  return items.reduce((sum, item) => sum + Math.max(0, Math.floor(Number(item.quantity) || 0)), 0);
}

/**
 * Partial advance = ৳perJersey × jersey count (1→300, 2→600, 3→900…).
 * Never exceeds order total.
 */
export function calcPartialAdvanceBdt(
  jerseyCount: number,
  perJerseyBdt: number = BKASH_PARTIAL_PER_JERSEY_BDT,
  orderTotal?: number,
): number {
  const per = Math.max(1, Math.round(Number(perJerseyBdt) || BKASH_PARTIAL_PER_JERSEY_BDT));
  const qty = Math.max(0, Math.floor(Number(jerseyCount) || 0));
  const advance = per * qty;
  if (orderTotal != null && Number.isFinite(orderTotal)) {
    return Math.min(advance, Math.max(0, Math.round(Number(orderTotal))));
  }
  return advance;
}

/** Human label e.g. "৳300 × 2 jerseys = ৳600" */
export function formatPartialAdvanceBreakdown(
  jerseyCount: number,
  perJerseyBdt: number = BKASH_PARTIAL_PER_JERSEY_BDT,
  paidAmount?: number,
): string {
  const per = Math.max(1, Math.round(Number(perJerseyBdt) || BKASH_PARTIAL_PER_JERSEY_BDT));
  const qty = Math.max(0, Math.floor(Number(jerseyCount) || 0));
  const paid =
    paidAmount != null
      ? Math.round(Number(paidAmount) || 0)
      : calcPartialAdvanceBdt(qty, per);
  const unit = qty === 1 ? 'jersey' : 'jerseys';
  return `৳${per.toLocaleString('en-BD')} × ${qty} ${unit} = ৳${paid.toLocaleString('en-BD')}`;
}

/** Machine-readable tag stored in customerNotes so all clients can restore partial/full. */
export function bkashPaymentNoteTag(meta: BkashPaymentMeta): string {
  return `[BKASH:${meta.type}:paid=${meta.paidAmount}:total=${meta.orderTotal}]`;
}

export function parseBkashPaymentMeta(
  customerNotes?: string | null,
  payments?: Array<{ amount?: unknown; rawPayload?: unknown }> | null,
): BkashPaymentMeta | null {
  const notes = String(customerNotes || '');
  const tagMatch = notes.match(TAG_RE);
  if (tagMatch) {
    const type = tagMatch[1].toLowerCase() === 'partial' ? 'partial' : 'full';
    const paidAmount = Number(tagMatch[2]) || 0;
    const orderTotal = Number(tagMatch[3]) || 0;
    return buildBkashPaymentMeta(type, paidAmount, orderTotal);
  }

  // Legacy note: BKASH_PARTIAL: send ৳300
  const legacyPartial = notes.match(/BKASH_PARTIAL:\s*send\s*৳?\s*([\d,]+)/i);
  const legacyFull = notes.match(/BKASH_FULL:\s*send\s*৳?\s*([\d,]+)/i);
  if (legacyPartial) {
    const paid = Number(String(legacyPartial[1]).replace(/,/g, '')) || 0;
    const payment = Array.isArray(payments) ? payments[0] : null;
    const totalFromPay =
      payment?.rawPayload &&
      typeof payment.rawPayload === 'object' &&
      payment.rawPayload !== null &&
      'orderTotal' in (payment.rawPayload as object)
        ? Number((payment.rawPayload as { orderTotal?: number }).orderTotal)
        : 0;
    return buildBkashPaymentMeta('partial', paid, totalFromPay || paid);
  }
  if (legacyFull) {
    const paid = Number(String(legacyFull[1]).replace(/,/g, '')) || 0;
    return buildBkashPaymentMeta('full', paid, paid);
  }

  const payment = Array.isArray(payments) ? payments[0] : null;
  const raw = payment?.rawPayload;
  if (raw && typeof raw === 'object' && raw !== null) {
    const payload = raw as {
      paymentType?: string;
      paidAmount?: number;
      orderTotal?: number;
    };
    if (payload.paymentType === 'partial' || payload.paymentType === 'full') {
      return buildBkashPaymentMeta(
        payload.paymentType,
        Number(payload.paidAmount ?? payment?.amount) || 0,
        Number(payload.orderTotal) || 0,
      );
    }
  }

  return null;
}

export function withBkashNote(
  existingNotes: string | undefined,
  meta: BkashPaymentMeta,
): string {
  const tag = bkashPaymentNoteTag(meta);
  const human =
    meta.type === 'partial'
      ? `BKASH_PARTIAL: send ৳${meta.paidAmount} now; ৳${meta.dueOnDelivery} due on delivery (order ৳${meta.orderTotal})`
      : `BKASH_FULL: send ৳${meta.paidAmount}`;
  const base = (existingNotes || '').trim();
  if (!base) return `${tag} ${human}`;
  if (TAG_RE.test(base)) return base.replace(TAG_RE, tag);
  return `${tag} ${human} | ${base}`;
}

/** Custom nameset printing requires full bKash — per-jersey advance is not allowed. */
export function cartItemHasNameset(item: {
  namesetEnabled?: boolean;
  customPrint?: { name?: string; number?: number } | null;
}): boolean {
  if (item.namesetEnabled) return true;
  const name = (item.customPrint?.name || '').trim();
  if (name) return true;
  const num = Number(item.customPrint?.number);
  return Number.isFinite(num) && num > 0;
}

export function cartRequiresFullBkashPayment(
  cart: Array<{
    namesetEnabled?: boolean;
    customPrint?: { name?: string; number?: number } | null;
  }>,
): boolean {
  return cart.some((item) => cartItemHasNameset(item));
}
