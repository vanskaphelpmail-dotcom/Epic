'use client';

import React, { useEffect } from 'react';
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

  if (!open || !order) return null;

  const when = new Date(order.createdAt || order.date || Date.now()).toLocaleString();
  const payment = String(order.paymentMethod || '').replace(/^POS\s+/i, '') || 'Cash';
  const billTo = order.shippingAddress?.fullName || 'Walk-in customer';

  const handlePrint = () => {
    document.body.classList.add(PRINT_BODY_CLASS);
    // Let the class apply before the browser captures the page for print
    window.setTimeout(() => {
      window.print();
      // Fallback if afterprint does not fire (some browsers)
      window.setTimeout(() => document.body.classList.remove(PRINT_BODY_CLASS), 1000);
    }, 50);
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-4 print:static print:bg-transparent print:p-0 print:inset-auto">
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xl w-full max-w-md max-h-[92vh] overflow-auto print:shadow-none print:border-0 print:max-w-none print:max-h-none print:rounded-none print:overflow-visible">
        <div className="px-4 py-3 border-b border-zinc-200 flex justify-end gap-2 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="text-[12px] font-semibold px-3 py-2 rounded-lg border border-zinc-300 cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="text-[12px] font-semibold px-3 py-2 rounded-lg bg-zinc-950 text-white cursor-pointer"
          >
            Print invoice
          </button>
        </div>

        <div className="px-5 py-6 text-zinc-950" id="pos-invoice-print">
          <div className="text-center space-y-1.5 mb-5">
            <div className="flex justify-center">
              <BrandMark imgClassName="w-10 h-10" />
            </div>
            <p className="text-lg font-bold tracking-tight">{shop.name}</p>
            {shop.address ? <p className="text-[11px] text-zinc-600 leading-snug">{shop.address}</p> : null}
            {shop.phone ? <p className="text-[11px] text-zinc-600">{shop.phone}</p> : null}
            {shop.website ? <p className="text-[11px] text-zinc-500">{shop.website}</p> : null}
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px] mb-4 border-y border-zinc-100 py-3">
            <span className="text-zinc-500">Invoice</span>
            <span className="text-right font-semibold">{order.id}</span>
            <span className="text-zinc-500">Date</span>
            <span className="text-right">{when}</span>
            <span className="text-zinc-500">Payment type</span>
            <span className="text-right">{payment}</span>
            <span className="text-zinc-500">Bill To</span>
            <span className="text-right">{billTo}</span>
            {order.paymentStatus && order.paymentStatus !== 'Paid' ? (
              <>
                <span className="text-zinc-500">Status</span>
                <span className="text-right font-semibold">{order.paymentStatus} · {order.status}</span>
              </>
            ) : null}
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
              {order.items.map((it, i) => {
                const unit = it.product.sellingPrice || it.product.price;
                const line = unit * it.quantity;
                return (
                  <tr key={`${it.product.id}-${i}`} className="border-b border-zinc-50 align-top">
                    <td className="py-2 pr-2">
                      <p className="font-medium text-zinc-950 leading-snug">{it.product.name}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Size {it.selectedSize}
                        {it.product.sku ? ` · ${it.product.sku}` : ''}
                      </p>
                      {it.customPrint ? (
                        <p className="text-[11px] text-zinc-500">
                          {it.customPrint.name} #{it.customPrint.number}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-2 text-center">{it.quantity}</td>
                    <td className="py-2 text-right whitespace-nowrap">{formatPrice(unit)}</td>
                    <td className="py-2 text-right font-semibold whitespace-nowrap">{formatPrice(line)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="space-y-1 text-[12px] mb-5">
            <div className="flex justify-between">
              <span className="text-zinc-500">Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">VAT (0%)</span>
              <span>{formatPrice(order.tax || 0)}</span>
            </div>
            <div className="flex justify-between font-bold text-[14px] pt-1 border-t border-zinc-100">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Paid money</span>
              <span>{formatPrice(order.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{payment}</span>
              <span>{formatPrice(order.total)}</span>
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
