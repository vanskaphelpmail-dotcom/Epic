'use client';

import React, { useMemo, useState } from 'react';
import type { Order } from '../../types';
import { EXCHANGE_POLICY, PosInvoice } from './PosInvoice';

type Props = {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  formatPrice: (n: number) => string;
  staffName: string;
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
};

type RangeKey =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'everything';

function dayStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function inRange(order: Order, key: RangeKey, from: string, to: string) {
  const raw = order.createdAt || order.date || '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return key === 'everything';
  const now = new Date();
  const startToday = dayStart(now);
  if (key === 'today') return d >= startToday;
  if (key === 'yesterday') {
    const y = new Date(startToday);
    y.setDate(y.getDate() - 1);
    return d >= y && d < startToday;
  }
  if (key === 'this_week') {
    const w = new Date(startToday);
    w.setDate(w.getDate() - w.getDay());
    return d >= w;
  }
  if (key === 'this_month') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (key === 'last_month') {
    const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return d.getMonth() === m && d.getFullYear() === y;
  }
  if (from && to) {
    const a = new Date(from);
    const b = new Date(to);
    b.setHours(23, 59, 59, 999);
    return d >= a && d <= b;
  }
  return true;
}

function orderTimestamp(order: Order): number {
  const raw = order.createdAt || order.date || '';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/** Always show date + time for POS and online sales */
function formatSaleDateTime(order: Order): string {
  const d = new Date(order.createdAt || order.date || '');
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function saleChannel(order: Order): 'POS' | 'Online' {
  const pm = String(order.paymentMethod || '').toLowerCase();
  if (pm.includes('pos') || order.id.startsWith('INV-')) return 'POS';
  return 'Online';
}

function persistOrders(next: Order[]) {
  try {
    localStorage.setItem('vault_orders', JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function SalesPanel({
  orders,
  setOrders,
  formatPrice,
  staffName,
  shopName,
  shopAddress,
  shopPhone,
}: Props) {
  const [range, setRange] = useState<RangeKey>('everything');
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [editCustomer, setEditCustomer] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPayment, setEditPayment] = useState('');
  const [editDiscountNote, setEditDiscountNote] = useState('');
  const [editTotal, setEditTotal] = useState('');
  const [searchInv, setSearchInv] = useState('');

  const filtered = useMemo(() => {
    const q = searchInv.trim().toLowerCase();
    return orders
      .filter((o) => {
        if (!inRange(o, range, from, to)) return false;
        if (!q) return true;
        return (
          o.id.toLowerCase().includes(q) ||
          (o.shippingAddress?.fullName || '').toLowerCase().includes(q) ||
          (o.shippingAddress?.phone || '').includes(q) ||
          String(o.paymentMethod || '').toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => orderTimestamp(b) - orderTimestamp(a));
  }, [orders, range, from, to, searchInv]);

  const totals = useMemo(() => {
    let cash = 0;
    let card = 0;
    let pos = 0;
    let web = 0;
    let other = 0;
    let paid = 0;
    let due = 0;
    let refunded = 0;
    for (const o of filtered) {
      const pm = String(o.paymentMethod || '').toLowerCase();
      if (pm.includes('pos')) pos += o.total;
      if (pm.includes('cash')) cash += o.total;
      else if (pm.includes('card')) card += o.total;
      else if (pm.includes('bkash') || pm.includes('cod') || pm.includes('website')) web += o.total;
      else other += o.total;
      if (o.paymentStatus === 'Refunded' || o.status === 'Returned') refunded += o.total;
      else if (o.paymentStatus === 'Unpaid') due += o.total;
      else paid += o.total;
    }
    return {
      total: filtered.reduce((s, o) => s + o.total, 0),
      count: filtered.length,
      cash,
      card,
      pos,
      web,
      other,
      paid,
      due,
      refunded,
    };
  }, [filtered]);

  const ranges: { id: RangeKey; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'this_week', label: 'This week' },
    { id: 'this_month', label: 'This month' },
    { id: 'last_month', label: 'Last month' },
    { id: 'everything', label: 'Everything' },
  ];

  const updateOrder = (id: string, patch: Partial<Order>) => {
    setOrders((prev) => {
      const next = prev.map((o) => (o.id === id ? { ...o, ...patch } : o));
      persistOrders(next);
      return next;
    });
  };

  const deleteOrder = (id: string) => {
    if (!window.confirm(`Delete invoice ${id}?`)) return;
    setOrders((prev) => {
      const next = prev.filter((o) => o.id !== id);
      persistOrders(next);
      return next;
    });
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const deleteSelected = () => {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} invoice(s)?`)) return;
    setOrders((prev) => {
      const next = prev.filter((o) => !selected.has(o.id));
      persistOrders(next);
      return next;
    });
    setSelected(new Set());
  };

  const openEdit = (o: Order) => {
    setEditOrder(o);
    setEditCustomer(o.shippingAddress?.fullName || '');
    setEditPhone(o.shippingAddress?.phone || '');
    setEditPayment(o.paymentMethod || '');
    setEditDiscountNote(o.customerNotes || '');
    setEditTotal(String(o.total));
  };

  const saveEdit = () => {
    if (!editOrder) return;
    const total = Math.max(0, Number(editTotal) || 0);
    updateOrder(editOrder.id, {
      total,
      subtotal: total,
      paymentMethod: editPayment.trim() || editOrder.paymentMethod,
      customerNotes: editDiscountNote,
      shippingAddress: {
        ...editOrder.shippingAddress,
        fullName: editCustomer.trim() || 'Walk-in customer',
        phone: editPhone.trim() || '—',
      },
      internalNotes: `${editOrder.internalNotes || ''} | Updated by ${staffName}`.trim(),
    });
    setEditOrder(null);
  };

  const exportCsv = () => {
    const rows = [
      ['DateTime', 'Channel', 'Invoice', 'Customer', 'Staff', 'Payment', 'Total', 'Status', 'PaymentStatus'],
      ...filtered.map((o) => [
        formatSaleDateTime(o),
        saleChannel(o),
        o.id,
        o.shippingAddress?.fullName || '',
        staffName,
        o.paymentMethod,
        String(o.total),
        o.status,
        o.paymentStatus || '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `sales-${range}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-zinc-600">
          Manage invoices by number — edit, refund, exchange, delete. {EXCHANGE_POLICY}
        </p>
        <button
          type="button"
          onClick={exportCsv}
          className="text-[12px] font-semibold px-3 py-2 rounded-lg border border-zinc-300 bg-white cursor-pointer"
        >
          Sales Excel
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-2">
        {[
          ['Total sales', formatPrice(totals.total), `${totals.count} invoices`],
          ['Cash', formatPrice(totals.cash), ''],
          ['Card / POS', formatPrice(totals.card + totals.pos), ''],
          ['Paid', formatPrice(totals.paid), ''],
          ['Refunded', formatPrice(totals.refunded), ''],
        ].map(([t, v, s]) => (
          <div key={String(t)} className="bg-white border border-zinc-200 rounded-xl p-3">
            <p className="text-[12px] text-zinc-500">{t}</p>
            <p className="text-lg font-bold text-zinc-950 mt-0.5">{v}</p>
            {s ? <p className="text-[11px] text-zinc-400">{s}</p> : null}
          </div>
        ))}
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {ranges.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={`text-[12px] font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer ${
                range === r.id ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-[11px] font-semibold text-zinc-500 uppercase">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setRange('everything');
              }}
              className="mt-1 block text-[13px] px-2 py-1.5 border border-zinc-200 rounded-lg font-normal normal-case"
            />
          </label>
          <label className="text-[11px] font-semibold text-zinc-500 uppercase">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setRange('everything');
              }}
              className="mt-1 block text-[13px] px-2 py-1.5 border border-zinc-200 rounded-lg font-normal normal-case"
            />
          </label>
          <label className="text-[11px] font-semibold text-zinc-500 uppercase flex-1 min-w-[12rem]">
            Invoice search
            <input
              value={searchInv}
              onChange={(e) => setSearchInv(e.target.value)}
              placeholder="INV-2026-… / customer / phone"
              className="mt-1 block w-full text-[13px] px-2 py-1.5 border border-zinc-200 rounded-lg font-normal normal-case"
            />
          </label>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100 flex flex-wrap gap-2 items-center justify-between">
          <p className="text-[14px] font-semibold text-zinc-950">Sales ({filtered.length})</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-[12px] font-semibold text-zinc-600 cursor-pointer"
              onClick={() => setSelected(new Set(filtered.map((o) => o.id)))}
            >
              Select visible
            </button>
            <button
              type="button"
              className="text-[12px] font-semibold text-red-600 cursor-pointer"
              onClick={deleteSelected}
            >
              Delete invoices ({selected.size})
            </button>
          </div>
        </div>
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-zinc-500">No sales for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-zinc-50 text-left text-zinc-600">
                <tr>
                  <th className="px-3 py-2 w-8" />
                  <th className="px-3 py-2 font-semibold">Date / Time</th>
                  <th className="px-3 py-2 font-semibold">Channel</th>
                  <th className="px-3 py-2 font-semibold">Invoice</th>
                  <th className="px-3 py-2 font-semibold">Customer</th>
                  <th className="px-3 py-2 font-semibold">Payment</th>
                  <th className="px-3 py-2 font-semibold">Total</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((o) => (
                  <tr key={o.id}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(o.id)}
                        onChange={(e) => {
                          setSelected((prev) => {
                            const n = new Set(prev);
                            if (e.target.checked) n.add(o.id);
                            else n.delete(o.id);
                            return n;
                          });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <p className="font-semibold text-zinc-950 text-[13px]">{formatSaleDateTime(o)}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-900 uppercase tracking-wide">
                        {saleChannel(o)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="font-semibold text-zinc-950 underline-offset-2 hover:underline cursor-pointer"
                        onClick={() => setInvoiceOrder(o)}
                      >
                        {o.id}
                      </button>
                    </td>
                    <td className="px-3 py-2">{o.shippingAddress?.fullName || '—'}</td>
                    <td className="px-3 py-2">{o.paymentMethod}</td>
                    <td className="px-3 py-2 font-semibold">{formatPrice(o.total)}</td>
                    <td className="px-3 py-2">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-800">
                        {o.paymentStatus === 'Refunded'
                          ? 'Refunded'
                          : o.status === 'Returned'
                            ? 'Exchanged'
                            : o.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-x-2 gap-y-1 text-[12px] font-semibold">
                        <button type="button" className="text-zinc-800 cursor-pointer" onClick={() => setInvoiceOrder(o)}>
                          Invoice
                        </button>
                        <button type="button" className="text-zinc-800 cursor-pointer" onClick={() => openEdit(o)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-zinc-800 cursor-pointer"
                          onClick={() => {
                            if (!window.confirm(`Refund invoice ${o.id}?`)) return;
                            updateOrder(o.id, {
                              paymentStatus: 'Refunded',
                              status: 'Returned',
                              internalNotes: `${o.internalNotes || ''} | Refunded by ${staffName}`.trim(),
                            });
                          }}
                        >
                          Refund
                        </button>
                        <button
                          type="button"
                          className="text-zinc-800 cursor-pointer"
                          onClick={() => {
                            if (!window.confirm(`Mark ${o.id} as exchanged (7-day policy)?`)) return;
                            updateOrder(o.id, {
                              status: 'Returned',
                              paymentStatus: o.paymentStatus === 'Refunded' ? 'Refunded' : 'Paid',
                              internalNotes: `${o.internalNotes || ''} | Exchange completed by ${staffName} · ${EXCHANGE_POLICY}`.trim(),
                              customerNotes: `${o.customerNotes || ''} | Exchange`.trim(),
                            });
                          }}
                        >
                          Exchange
                        </button>
                        <button type="button" className="text-red-600 cursor-pointer" onClick={() => deleteOrder(o.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editOrder && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-xl w-full max-w-md p-5 space-y-3">
            <h3 className="text-[16px] font-bold text-zinc-950">Update sale · {editOrder.id}</h3>
            <label className="block text-[12px] font-semibold text-zinc-600">
              Customer
              <input
                value={editCustomer}
                onChange={(e) => setEditCustomer(e.target.value)}
                className="mt-1 w-full text-[13px] px-3 py-2 border border-zinc-200 rounded-lg font-normal"
              />
            </label>
            <label className="block text-[12px] font-semibold text-zinc-600">
              Mobile
              <input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="mt-1 w-full text-[13px] px-3 py-2 border border-zinc-200 rounded-lg font-normal"
              />
            </label>
            <label className="block text-[12px] font-semibold text-zinc-600">
              Payment method
              <input
                value={editPayment}
                onChange={(e) => setEditPayment(e.target.value)}
                className="mt-1 w-full text-[13px] px-3 py-2 border border-zinc-200 rounded-lg font-normal"
              />
            </label>
            <label className="block text-[12px] font-semibold text-zinc-600">
              Total
              <input
                type="number"
                value={editTotal}
                onChange={(e) => setEditTotal(e.target.value)}
                className="mt-1 w-full text-[13px] px-3 py-2 border border-zinc-200 rounded-lg font-normal"
              />
            </label>
            <label className="block text-[12px] font-semibold text-zinc-600">
              Notes
              <textarea
                value={editDiscountNote}
                onChange={(e) => setEditDiscountNote(e.target.value)}
                rows={2}
                className="mt-1 w-full text-[13px] px-3 py-2 border border-zinc-200 rounded-lg font-normal"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditOrder(null)}
                className="text-[13px] font-semibold px-3 py-2 rounded-lg border border-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="text-[13px] font-semibold px-4 py-2 rounded-lg bg-zinc-950 text-white cursor-pointer"
              >
                Save updates
              </button>
            </div>
          </div>
        </div>
      )}

      <PosInvoice
        open={!!invoiceOrder}
        order={invoiceOrder}
        formatPrice={formatPrice}
        shop={{ name: shopName, address: shopAddress, phone: shopPhone }}
        onClose={() => setInvoiceOrder(null)}
      />
    </div>
  );
}
