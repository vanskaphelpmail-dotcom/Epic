'use client';

import React, { useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import type { Order } from '../../types';
import { BrandMark } from '../BrandMark';

export const EXCHANGE_POLICY = 'Exchange within 7 days — bring this invoice.';

const PRINT_BODY_CLASS = 'print-pos-invoice';

type ShopInfo = {
  name: string;
  address?: string;
  phone?: string;
  website?: string;
};

type Props = {
  open: boolean;
  order: Order | null;
  formatPrice: (n: number) => string;
  shop: ShopInfo;
  onClose: () => void;
};

export function PosInvoice({ open, order, formatPrice, shop, onClose }: Props) {
  useEffect(() => {
    const clear = () => document.body.classList.remove(PRINT_BODY_CLASS);
    window.addEventListener('afterprint', clear);
    return () => {
      window.removeEventListener('afterprint', clear);
      clear();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !order) return null;

  const when = new Date(order.createdAt || order.date || Date.now()).toLocaleString();
  const payment = String(order.paymentMethod || '').replace(/^POS\s+/i, '') || 'Cash';
  const billTo = order.shippingAddress?.fullName || 'Walk-in customer';
  const shipping =
    Number(order.shipping) ||
    Math.max(0, Number(order.total || 0) - Number(order.subtotal || 0) - Number(order.tax || 0));
  const paidAmount =
    order.paymentStatus === 'Unpaid' || order.paymentStatus === 'Partial'
      ? Number((order as { amountPaid?: number }).amountPaid) || 0
      : Number(order.total) || 0;

  // Invoice amounts: numbers only (no ৳ / currency symbol)
  const money = (n: number) => {
    const raw = formatPrice(Number(n) || 0);
    return String(raw)
      .replace(/৳/g, '')
      .replace(/^(BDT|Tk\.?|tk\.?)\s*/i, '')
      .trim();
  };

  const handlePrint = () => {
    document.body.classList.add(PRINT_BODY_CLASS);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => document.body.classList.remove(PRINT_BODY_CLASS), 1000);
    }, 50);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3 sm:p-4 print:static print:bg-transparent print:p-0 print:inset-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Invoice"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-lg max-h-[min(94vh,900px)] flex flex-col overflow-hidden print:shadow-none print:border-0 print:max-w-none print:max-h-none print:rounded-none print:overflow-visible">
        {/* Always-visible actions (screen only) */}
        <div className="shrink-0 sticky top-0 z-20 px-3 sm:px-4 py-3 border-b border-zinc-200 bg-white flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Invoice preview</p>
            <p className="text-xs font-mono text-zinc-800 truncate">{order.id}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-2.5 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 cursor-pointer shadow-sm"
            >
              <Printer size={15} />
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 cursor-pointer"
              aria-label="Close invoice"
            >
              <X size={16} />
              Close
            </button>
          </div>
        </div>

        {/* Scrollable receipt body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="px-5 py-6 text-zinc-950" id="pos-invoice-print">
            <div className="text-center space-y-1.5 mb-5">
              <div className="flex justify-center">
                <BrandMark bare imgClassName="w-12 h-12" />
              </div>
              <p className="text-lg font-bold tracking-tight">{shop.name}</p>
              {shop.address ? <p className="text-[11px] text-zinc-600 leading-snug">{shop.address}</p> : null}
              {shop.phone ? <p className="text-[11px] text-zinc-600">{shop.phone}</p> : null}
              {shop.website ? <p className="text-[11px] text-zinc-500">{shop.website}</p> : null}
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px] mb-4 border-y border-zinc-100 py-3">
              <span className="text-zinc-500">Invoice</span>
              <span className="text-right font-semibold break-all">{order.id}</span>
              <span className="text-zinc-500">Date</span>
              <span className="text-right">{when}</span>
              <span className="text-zinc-500">Payment type</span>
              <span className="text-right">{payment}</span>
              <span className="text-zinc-500">Bill To</span>
              <span className="text-right font-medium">{billTo}</span>
              {order.shippingAddress?.phone ? (
                <>
                  <span className="text-zinc-500">Phone</span>
                  <span className="text-right">{order.shippingAddress.phone}</span>
                </>
              ) : null}
              <span className="text-zinc-500">Status</span>
              <span className="text-right font-semibold">
                {order.paymentStatus || 'Paid'} · {order.status}
              </span>
            </div>

            <table className="w-full text-[12px] mb-3">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-100">
                  <th className="py-1.5 font-semibold">Product</th>
                  <th className="py-1.5 font-semibold text-center">Qty</th>
                  <th className="py-1.5 font-semibold text-right">Price</th>
                  <th className="py-1.5 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((it, i) => {
                  const unit = Number(it.product?.sellingPrice || it.product?.price || 0);
                  const line = unit * (Number(it.quantity) || 0);
                  return (
                    <tr key={`${it.product?.id || i}-${i}`} className="border-b border-zinc-50 align-top">
                      <td className="py-2 pr-2">
                        <p className="font-medium text-zinc-950 leading-snug">{it.product?.name || 'Item'}</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          Size {it.selectedSize || '—'}
                          {it.product?.sku ? ` · ${it.product.sku}` : ''}
                        </p>
                        {it.customPrint ? (
                          <p className="text-[11px] text-zinc-500">
                            {it.customPrint.name} #{it.customPrint.number}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-2 text-center">{it.quantity}</td>
                      <td className="py-2 text-right whitespace-nowrap">{money(unit)}</td>
                      <td className="py-2 text-right font-semibold whitespace-nowrap">{money(line)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="space-y-1 text-[12px] mb-5">
              <div className="flex justify-between">
                <span className="text-zinc-500">Subtotal</span>
                <span>{money(order.subtotal)}</span>
              </div>
              {shipping > 0 ? (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Shipping / delivery</span>
                  <span>{money(shipping)}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-zinc-500">VAT (0%)</span>
                <span>{money(order.tax || 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-[14px] pt-1 border-t border-zinc-100">
                <span>Total</span>
                <span>{money(order.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Paid money</span>
                <span>{money(paidAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">{payment}</span>
                <span>{money(paidAmount)}</span>
              </div>
            </div>

            <div className="text-center space-y-2 pt-2 border-t border-zinc-100">
              <p className="text-[13px] text-zinc-800">Thank you for shopping with us.</p>
              <p className="text-[12px] font-semibold text-zinc-950 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 leading-snug">
                {EXCHANGE_POLICY}
              </p>
              <p className="text-[10px] text-zinc-400">Keep invoice no. {order.id} for exchange / refund.</p>
            </div>
          </div>
        </div>

        {/* Bottom actions for mobile thumb reach */}
        <div className="shrink-0 sticky bottom-0 z-20 px-3 sm:px-4 py-3 border-t border-zinc-200 bg-white flex gap-2 print:hidden sm:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-[12px] font-bold py-3 rounded-xl bg-zinc-950 text-white cursor-pointer"
          >
            <Printer size={15} />
            Print
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-[12px] font-bold py-3 rounded-xl border border-zinc-300 cursor-pointer"
          >
            <X size={16} />
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function nextInvoiceNumber(existingIds: string[]): string {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  let max = 0;
  for (const id of existingIds) {
    if (!id.startsWith(prefix)) continue;
    const n = Number(id.slice(prefix.length));
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return `${prefix}${String(max + 1).padStart(6, '0')}`;
}
