'use client';

import React, { useMemo, useState } from 'react';
import type { CartItem, Order, Product } from '../../types';
import type { CustomerProfile } from '../AdminPanel';
import { loadTillCash, recordSaleIntoTill, saveTillCash } from '../../lib/retailStore';
import { normalizeBarcode } from '../../lib/retailCodes';
import {
  getNamesetLabel,
  getNamesetPriceBdt,
  getProductBadgeOptions,
} from '../../lib/productAddons';
import { nextInvoiceNumber, PosInvoice } from './PosInvoice';

type BillLine = {
  key: string;
  productId: string;
  name: string;
  sku: string;
  barcode?: string;
  size: string;
  unitPrice: number;
  basePrice: number;
  qty: number;
  customName?: string;
  jerseyNumber?: string;
  namesetEnabled?: boolean;
  selectedBadges?: string[];
  badgeLabels?: string[];
};

type Props = {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  customers: CustomerProfile[];
  setCustomers: React.Dispatch<React.SetStateAction<CustomerProfile[]>>;
  formatPrice: (n: number) => string;
  staffName: string;
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
};

function lineUnitPrice(p: Product, opts: {
  nameset: boolean;
  badges: string[];
}): number {
  let price = Number(p.sellingPrice || p.price) || 0;
  if (opts.nameset && p.printAvailable !== false) {
    price += getNamesetPriceBdt(p);
  }
  const badgeOpts = getProductBadgeOptions(p);
  for (const id of opts.badges) {
    const b = badgeOpts.find((x) => x.id === id);
    if (b) price += b.priceBdt;
  }
  return price;
}

export function PosPanel({
  products,
  setProducts,
  orders,
  setOrders,
  customers,
  setCustomers,
  formatPrice,
  staffName,
  shopName,
  shopAddress,
  shopPhone,
}: Props) {
  const [query, setQuery] = useState('');
  const [lines, setLines] = useState<BillLine[]>([]);
  const [billTo, setBillTo] = useState('');
  const [mobile, setMobile] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [postal, setPostal] = useState('');
  const [payment, setPayment] = useState<'Cash' | 'Card' | 'bKash' | 'Split'>('Cash');
  const [discount, setDiscount] = useState(0);
  const [till, setTill] = useState(() => loadTillCash());
  const [msg, setMsg] = useState('');
  const [clockIn] = useState(() => new Date().toLocaleString());
  const [payStep, setPayStep] = useState<'idle' | 'type' | 'cash' | 'split'>('idle');
  const [cashReceived, setCashReceived] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);

  // Configure sheet when adding a product
  const [configProduct, setConfigProduct] = useState<Product | null>(null);
  const [cfgSize, setCfgSize] = useState('');
  const [cfgQty, setCfgQty] = useState(1);
  const [cfgNameset, setCfgNameset] = useState(false);
  const [cfgName, setCfgName] = useState('');
  const [cfgNumber, setCfgNumber] = useState('');
  const [cfgBadges, setCfgBadges] = useState<string[]>([]);

  const nowLabel = new Date().toLocaleString();
  const catalogStockUnits = products.reduce((s, p) => s + (Number(p.stock) || 0), 0);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => {
        const barcode = p.barcode || '';
        const playerNum = p.player?.number != null ? String(p.player.number) : '';
        const playerName = p.player?.name || '';
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          barcode.toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q) ||
          (p.club || '').toLowerCase().includes(q) ||
          (p.league || '').toLowerCase().includes(q) ||
          playerName.toLowerCase().includes(q) ||
          playerNum.includes(q) ||
          (p.color || '').toLowerCase().includes(q) ||
          (p.sizes || []).some((sz) => sz.toLowerCase() === q)
        );
      })
      .slice(0, 10);
  }, [products, query]);

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  const openConfigure = (p: Product) => {
    const sizes = p.sizes?.length ? p.sizes : ['OS'];
    const pick =
      sizes.find((sz) => (p.sizeStocks?.[sz] ?? p.stock) > 0) || sizes[0];
    setConfigProduct(p);
    setCfgSize(pick);
    setCfgQty(1);
    setCfgNameset(false);
    setCfgName(p.player?.name || '');
    setCfgNumber(p.player?.number != null ? String(p.player.number) : '');
    setCfgBadges([]);
    setQuery('');
    setMsg('');
  };

  const confirmConfigure = () => {
    if (!configProduct) return;
    if (cfgNameset && (!cfgName.trim() || !cfgNumber.trim())) {
      setMsg('Enter custom name and jersey number for font printing');
      return;
    }
    const available = configProduct.sizeStocks?.[cfgSize] ?? configProduct.stock;
    if (available < cfgQty && !configProduct.isPreOrder) {
      setMsg(`Only ${available} in stock for size ${cfgSize}`);
      return;
    }
    const badges = getProductBadgeOptions(configProduct).filter((b) => cfgBadges.includes(b.id));
    const unit = lineUnitPrice(configProduct, { nameset: cfgNameset, badges: cfgBadges });
    const key = [
      configProduct.id,
      cfgSize,
      cfgNameset ? `${cfgName}-${cfgNumber}` : 'plain',
      cfgBadges.slice().sort().join(','),
    ].join('|');

    setLines((prev) => {
      const idx = prev.findIndex((l) => l.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + cfgQty };
        return next;
      }
      return [
        ...prev,
        {
          key,
          productId: configProduct.id,
          name: configProduct.name,
          sku: configProduct.sku,
          barcode: configProduct.barcode,
          size: cfgSize,
          basePrice: configProduct.sellingPrice || configProduct.price,
          unitPrice: unit,
          qty: cfgQty,
          customName: cfgNameset ? cfgName.trim() : undefined,
          jerseyNumber: cfgNameset ? cfgNumber.trim() : undefined,
          namesetEnabled: cfgNameset,
          selectedBadges: cfgBadges.length ? [...cfgBadges] : undefined,
          badgeLabels: badges.map((b) => b.label),
        },
      ];
    });
    setConfigProduct(null);
    setMsg('');
  };

  const tryAddFromQuery = () => {
    const q = normalizeBarcode(query);
    if (!q) return;
    const byCode = products.find((p) => {
      const barcode = normalizeBarcode(p.barcode || '');
      return barcode === q || p.sku.toLowerCase() === q.toLowerCase();
    });
    if (byCode) {
      openConfigure(byCode);
      return;
    }
    if (matches[0]) openConfigure(matches[0]);
    else setMsg('No product found');
  };

  const completeSale = (method: 'Cash' | 'Card' | 'bKash' | 'Split', detail?: string) => {
    if (!lines.length) {
      setMsg('Add items to the bill first');
      return;
    }

    setProducts((prev) =>
      prev.map((p) => {
        const billLines = lines.filter((l) => l.productId === p.id);
        if (!billLines.length) return p;
        let stock = p.stock;
        const sizeStocks = { ...(p.sizeStocks || {}) };
        for (const l of billLines) {
          stock = Math.max(0, stock - l.qty);
          if (sizeStocks[l.size] != null) {
            sizeStocks[l.size] = Math.max(0, (sizeStocks[l.size] || 0) - l.qty);
          }
        }
        return { ...p, stock, sizeStocks };
      }),
    );

    const orderId = nextInvoiceNumber(orders.map((o) => o.id));
    const customerName = billTo.trim() || 'Walk-in customer';
    const payLabel = detail ? `POS ${method} (${detail})` : `POS ${method}`;
    const order: Order = {
      id: orderId,
      date: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      deliveryRegion: 'inside',
      deliveryCharge: 0,
      items: lines.map((l) => {
        const product = products.find((p) => p.id === l.productId)!;
        const priced = {
          ...product,
          price: l.unitPrice,
          sellingPrice: l.unitPrice,
        };
        const item: CartItem = {
          product: priced,
          selectedSize: l.size,
          quantity: l.qty,
          namesetEnabled: l.namesetEnabled,
          selectedBadges: l.selectedBadges,
          customPrint:
            l.namesetEnabled && l.customName
              ? {
                  name: l.customName,
                  number: Number(l.jerseyNumber) || 0,
                }
              : undefined,
        };
        return item;
      }),
      subtotal,
      tax: 0,
      shipping: 0,
      total,
      status: 'Delivered',
      shippingAddress: {
        fullName: customerName,
        phone: mobile.trim() || '—',
        addressLine1: address.trim() || 'In-store',
        city: city.trim() || '—',
        postalCode: postal.trim() || '—',
        country: 'Bangladesh',
      },
      paymentMethod: payLabel,
      paymentStatus: 'Paid',
      internalNotes: `POS sale by ${staffName}`,
      customerNotes: [
        discount > 0 ? `Discount ${discount}` : '',
        ...lines
          .filter((l) => l.namesetEnabled || (l.badgeLabels && l.badgeLabels.length))
          .map((l) => {
            const bits = [`${l.name} (${l.size})`];
            if (l.customName) bits.push(`Name ${l.customName} #${l.jerseyNumber}`);
            if (l.badgeLabels?.length) bits.push(`Patches: ${l.badgeLabels.join(', ')}`);
            return bits.join(' · ');
          }),
      ]
        .filter(Boolean)
        .join(' | '),
    };

    setOrders((prev) => [order, ...prev]);
    try {
      const stored = localStorage.getItem('vault_orders');
      const list = stored ? JSON.parse(stored) : [];
      localStorage.setItem('vault_orders', JSON.stringify([order, ...list]));
    } catch {
      /* ignore */
    }

    if (mobile.trim() || billTo.trim()) {
      setCustomers((prev) => {
        const phone = mobile.trim();
        const existing = prev.find(
          (c) =>
            (phone && c.phone === phone) ||
            (billTo && c.fullName.toLowerCase() === billTo.trim().toLowerCase()),
        );
        if (existing) {
          const next = prev.map((c) =>
            c.id === existing.id
              ? {
                  ...c,
                  ordersCount: c.ordersCount + 1,
                  totalSpent: c.totalSpent + total,
                  phone: phone || c.phone,
                  city: city || c.city,
                  address: address || c.address,
                }
              : c,
          );
          localStorage.setItem('vault_saved_customers', JSON.stringify(next));
          return next;
        }
        const row: CustomerProfile = {
          id: `cust-pos-${Date.now()}`,
          fullName: customerName,
          email: '',
          phone: phone || '—',
          address: address || 'In-store',
          city: city || '—',
          location: city || '—',
          ordersCount: 1,
          totalSpent: total,
          joinedDate: new Date().toISOString().slice(0, 10),
        };
        const next = [row, ...prev];
        localStorage.setItem('vault_saved_customers', JSON.stringify(next));
        return next;
      });
    }

    recordSaleIntoTill(total, method);
    setTill(loadTillCash());
    setLines([]);
    setDiscount(0);
    setBillTo('');
    setMobile('');
    setCity('');
    setAddress('');
    setPostal('');
    setPayStep('idle');
    setCashReceived('');
    setSplitCash('');
    setSplitCard('');
    setPayment(method === 'Split' ? 'Cash' : method === 'bKash' ? 'bKash' : method);
    setInvoiceOrder(order);
    setMsg(`Sale ${orderId} completed · ${formatPrice(total)}`);
  };

  const startCheckout = () => {
    if (!lines.length) {
      setMsg('Add items to the bill first');
      return;
    }
    setPayStep('type');
  };

  const cashChange = Math.max(0, (Number(cashReceived) || 0) - total);

  const todaySales = orders
    .filter((o) => {
      const d = (o.createdAt || o.date || '').slice(0, 10);
      return d === new Date().toISOString().slice(0, 10) && String(o.paymentMethod || '').includes('POS');
    })
    .reduce((s, o) => s + o.total, 0);

  const cfgPreviewPrice = configProduct
    ? lineUnitPrice(configProduct, { nameset: cfgNameset, badges: cfgBadges }) * cfgQty
    : 0;

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-wrap items-center gap-4 justify-between">
        <div className="text-[12px] space-y-0.5">
          <p className="font-semibold text-zinc-950">{staffName}</p>
          <p className="text-zinc-500">Clock in: {clockIn}</p>
        </div>
        <div className="flex flex-wrap gap-4 text-[12px]">
          <div>
            <p className="text-zinc-500 uppercase text-[10px] font-semibold">Catalog stock</p>
            <p className="font-bold text-zinc-950">
              {products.length} products · {catalogStockUnits} units
            </p>
          </div>
          <div>
            <p className="text-zinc-500 uppercase text-[10px] font-semibold">My sales</p>
            <p className="font-bold text-zinc-950">{formatPrice(todaySales)}</p>
          </div>
          <div>
            <p className="text-zinc-500 uppercase text-[10px] font-semibold">Till cash</p>
            <p className="font-bold text-zinc-950">{formatPrice(till)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const v = window.prompt('Set till cash amount', String(till));
            if (v == null) return;
            const n = Number(v);
            if (!Number.isFinite(n)) return;
            saveTillCash(n);
            setTill(n);
          }}
          className="text-[12px] font-semibold px-3 py-2 rounded-lg border border-zinc-300 cursor-pointer"
        >
          Adjust till
        </button>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-zinc-950">Product search</h3>
          <span className="text-[11px] text-zinc-500">{shopName} POS</span>
        </div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                tryAddFromQuery();
              }
            }}
            placeholder="Search or scan — name, SKU, barcode, club, player #, size…"
            className="flex-1 text-[13px] px-3 py-2.5 rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-400"
            autoFocus
          />
          <button
            type="button"
            onClick={tryAddFromQuery}
            className="px-4 py-2.5 rounded-lg bg-zinc-950 text-white text-[13px] font-semibold cursor-pointer"
          >
            Add
          </button>
        </div>
        {matches.length > 0 && query && (
          <ul className="border border-zinc-200 rounded-lg divide-y divide-zinc-100 max-h-56 overflow-auto">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => openConfigure(p)}
                  className="w-full text-left px-3 py-2.5 hover:bg-zinc-50 flex justify-between gap-2 cursor-pointer"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-zinc-950 truncate">{p.name}</span>
                    <span className="block text-[11px] text-zinc-500 truncate">
                      {p.sku}
                      {p.barcode ? ` · ${p.barcode}` : ''}
                      {p.player?.number != null ? ` · #${p.player.number}` : ''}
                      {p.club ? ` · ${p.club}` : ''}
                    </span>
                  </span>
                  <span className="text-[12px] text-zinc-500 shrink-0">
                    {formatPrice(p.sellingPrice || p.price)} · stock {p.stock}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[12px] text-zinc-500">
          Pick a jersey, then choose size, custom name/number, and patches before it hits the bill.
        </p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-zinc-950">Current bill</h3>
          <p className="text-[12px] text-zinc-500">Sale date & time: {nowLabel}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {[
            ['Bill to', billTo, setBillTo],
            ['Mobile', mobile, setMobile],
            ['City', city, setCity],
            ['Address', address, setAddress],
            ['Postal', postal, setPostal],
          ].map(([label, val, set]) => (
            <label key={String(label)} className="block text-[11px] font-semibold text-zinc-500 uppercase">
              {label as string}
              <input
                value={val as string}
                onChange={(e) => (set as (v: string) => void)(e.target.value)}
                className="mt-1 w-full text-[13px] px-2.5 py-2 rounded-lg border border-zinc-200 text-zinc-950 font-normal normal-case"
              />
            </label>
          ))}
        </div>

        {lines.length === 0 ? (
          <p className="text-[13px] text-zinc-500 py-10 text-center border border-dashed border-zinc-200 rounded-lg">
            No items on the bill yet.
          </p>
        ) : (
          <div className="overflow-x-auto border border-zinc-200 rounded-lg">
            <table className="w-full text-[13px]">
              <thead className="bg-zinc-50 text-zinc-600 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">Item</th>
                  <th className="px-3 py-2 font-semibold">Size</th>
                  <th className="px-3 py-2 font-semibold">Qty</th>
                  <th className="px-3 py-2 font-semibold">Price</th>
                  <th className="px-3 py-2 font-semibold">Line</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {lines.map((l) => (
                  <tr key={l.key}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-zinc-950">{l.name}</p>
                      <p className="text-[11px] text-zinc-500">{l.sku}</p>
                      {(l.customName || l.badgeLabels?.length) && (
                        <p className="text-[11px] text-zinc-600 mt-0.5">
                          {l.customName ? `${l.customName} #${l.jerseyNumber}` : ''}
                          {l.customName && l.badgeLabels?.length ? ' · ' : ''}
                          {l.badgeLabels?.length ? `Patches: ${l.badgeLabels.join(', ')}` : ''}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">{l.size}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        value={l.qty}
                        onChange={(e) => {
                          const qty = Math.max(1, Number(e.target.value) || 1);
                          setLines((prev) => prev.map((x) => (x.key === l.key ? { ...x, qty } : x)));
                        }}
                        className="w-16 px-2 py-1 border border-zinc-200 rounded"
                      />
                    </td>
                    <td className="px-3 py-2">{formatPrice(l.unitPrice)}</td>
                    <td className="px-3 py-2 font-semibold">{formatPrice(l.unitPrice * l.qty)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="text-red-600 text-[12px] font-semibold cursor-pointer"
                        onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3 justify-between border-t border-zinc-100 pt-4">
          <div className="flex flex-wrap gap-3">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase">
              Discount
              <input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                className="mt-1 block w-28 text-[13px] px-2.5 py-2 rounded-lg border border-zinc-200 font-normal normal-case"
              />
            </label>
          </div>
          <div className="text-right">
            <p className="text-[12px] text-zinc-500">Subtotal {formatPrice(subtotal)}</p>
            <p className="text-xl font-bold text-zinc-950">{formatPrice(total)}</p>
            <button
              type="button"
              onClick={startCheckout}
              className="mt-2 px-5 py-2.5 rounded-lg bg-zinc-950 text-white text-[13px] font-semibold cursor-pointer"
            >
              Complete sale
            </button>
          </div>
        </div>
        {msg && <p className="text-[13px] text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">{msg}</p>}
      </div>

      {configProduct && (
        <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-2xl border border-zinc-200 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-zinc-200 flex justify-between items-start gap-2">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-zinc-950 truncate">{configProduct.name}</p>
                <p className="text-[12px] text-zinc-500">
                  {configProduct.sku}
                  {configProduct.barcode ? ` · ${configProduct.barcode}` : ''} · stock {configProduct.stock}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfigProduct(null)}
                className="text-[12px] font-semibold px-2 py-1 border border-zinc-300 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <p className="text-[11px] font-semibold text-zinc-500 uppercase mb-2">Size</p>
                <div className="flex flex-wrap gap-1.5">
                  {(configProduct.sizes?.length ? configProduct.sizes : ['OS']).map((sz) => {
                    const qty = configProduct.sizeStocks?.[sz];
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setCfgSize(sz)}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border cursor-pointer ${
                          cfgSize === sz
                            ? 'bg-zinc-950 text-white border-zinc-950'
                            : 'bg-white text-zinc-800 border-zinc-200'
                        }`}
                      >
                        {sz}
                        {qty != null ? ` (${qty})` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block text-[11px] font-semibold text-zinc-500 uppercase">
                Qty
                <input
                  type="number"
                  min={1}
                  value={cfgQty}
                  onChange={(e) => setCfgQty(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-24 text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
                />
              </label>

              {configProduct.printAvailable !== false && (
                <div className="border border-zinc-200 rounded-xl p-3 space-y-2">
                  <label className="flex items-center gap-2 text-[13px] font-medium text-zinc-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cfgNameset}
                      onChange={(e) => setCfgNameset(e.target.checked)}
                    />
                    {getNamesetLabel(configProduct)} (+{formatPrice(getNamesetPriceBdt(configProduct))})
                  </label>
                  {cfgNameset && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] font-semibold text-zinc-500 uppercase">
                        Custom name
                        <input
                          value={cfgName}
                          onChange={(e) => setCfgName(e.target.value)}
                          className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
                          placeholder="e.g. RONALDO"
                        />
                      </label>
                      <label className="text-[11px] font-semibold text-zinc-500 uppercase">
                        Jersey number
                        <input
                          value={cfgNumber}
                          onChange={(e) => setCfgNumber(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                          className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
                          placeholder="7"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {configProduct.badgeAvailable !== false && getProductBadgeOptions(configProduct).length > 0 && (
                <div className="border border-zinc-200 rounded-xl p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-zinc-500 uppercase">Tournament Patch</p>
                  {getProductBadgeOptions(configProduct).map((b) => (
                    <label
                      key={b.id}
                      className="flex items-center justify-between gap-2 text-[13px] text-zinc-900 cursor-pointer"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={cfgBadges.includes(b.id)}
                          onChange={(e) => {
                            setCfgBadges((prev) =>
                              e.target.checked ? [...prev, b.id] : prev.filter((id) => id !== b.id),
                            );
                          }}
                        />
                        {b.image ? (
                          <img src={b.image} alt="" className="h-7 w-7 rounded object-cover border border-zinc-200" />
                        ) : null}
                        <span className="truncate">{b.label}</span>
                      </span>
                      <span className="text-zinc-500 shrink-0">+{formatPrice(b.priceBdt)}</span>
                    </label>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-[14px] font-bold text-zinc-950">{formatPrice(cfgPreviewPrice)}</p>
                <button
                  type="button"
                  onClick={confirmConfigure}
                  className="px-4 py-2.5 rounded-lg bg-zinc-950 text-white text-[13px] font-semibold cursor-pointer"
                >
                  Add to bill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {payStep === 'type' && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-xl w-full max-w-lg p-5">
            <h3 className="text-lg font-bold text-zinc-950 text-center">Select Payment Type</h3>
            <p className="text-[12px] text-zinc-500 text-center mt-1">Total Payable</p>
            <p className="text-2xl font-bold text-zinc-950 text-center mt-0.5">{formatPrice(total)}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
              {[
                { id: 'Cash' as const, title: 'Cash', sub: 'Pay with cash' },
                { id: 'Card' as const, title: 'Card / other', sub: 'Card, bank, bKash' },
                { id: 'Split' as const, title: 'Split Bill', sub: 'Cash + other' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    if (opt.id === 'Cash') {
                      setPayment('Cash');
                      setCashReceived(String(total));
                      setPayStep('cash');
                    } else if (opt.id === 'Card') {
                      completeSale('Card');
                    } else {
                      setSplitCash(String(Math.round(total / 2)));
                      setSplitCard(String(total - Math.round(total / 2)));
                      setPayStep('split');
                    }
                  }}
                  className="border border-zinc-200 rounded-xl p-4 text-left hover:border-zinc-400 cursor-pointer"
                >
                  <p className="text-[14px] font-semibold text-zinc-950">{opt.title}</p>
                  <p className="text-[12px] text-zinc-500 mt-1">{opt.sub}</p>
                </button>
              ))}
            </div>
            <div className="flex justify-center mt-5">
              <button
                type="button"
                onClick={() => setPayStep('idle')}
                className="text-[13px] font-semibold px-4 py-2 rounded-lg border border-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {payStep === 'cash' && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-xl w-full max-w-sm p-5">
            <h3 className="text-lg font-bold text-zinc-950 text-center">Cash Payment</h3>
            <p className="text-[12px] text-zinc-500 text-center mt-2">Total Payable</p>
            <p className="text-2xl font-bold text-zinc-950 text-center">{formatPrice(total)}</p>
            <label className="block text-[12px] font-semibold text-zinc-700 mt-4">
              Cash Received
              <input
                type="number"
                min={0}
                autoFocus
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className="mt-1 w-full text-[14px] px-3 py-2.5 border border-zinc-200 rounded-lg"
              />
            </label>
            <p className="text-[13px] text-zinc-700 mt-3">
              Change <span className="font-bold">{formatPrice(cashChange)}</span>
            </p>
            <div className="flex justify-between gap-2 mt-5">
              <button
                type="button"
                onClick={() => setPayStep('type')}
                className="text-[13px] font-semibold px-4 py-2 rounded-lg border border-zinc-300 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if ((Number(cashReceived) || 0) < total) {
                    setMsg('Cash received is less than total');
                    return;
                  }
                  completeSale('Cash', `received ${cashReceived}`);
                }}
                className="text-[13px] font-semibold px-5 py-2 rounded-lg bg-zinc-950 text-white cursor-pointer"
              >
                Paid
              </button>
            </div>
          </div>
        </div>
      )}

      {payStep === 'split' && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-xl w-full max-w-sm p-5">
            <h3 className="text-lg font-bold text-zinc-950 text-center">Split Bill</h3>
            <p className="text-[12px] text-zinc-500 text-center mt-2">Total {formatPrice(total)}</p>
            <label className="block text-[12px] font-semibold text-zinc-700 mt-4">
              Cash portion
              <input
                type="number"
                value={splitCash}
                onChange={(e) => {
                  setSplitCash(e.target.value);
                  const c = Number(e.target.value) || 0;
                  setSplitCard(String(Math.max(0, total - c)));
                }}
                className="mt-1 w-full text-[14px] px-3 py-2.5 border border-zinc-200 rounded-lg"
              />
            </label>
            <label className="block text-[12px] font-semibold text-zinc-700 mt-3">
              Card / other
              <input
                type="number"
                value={splitCard}
                onChange={(e) => {
                  setSplitCard(e.target.value);
                  const c = Number(e.target.value) || 0;
                  setSplitCash(String(Math.max(0, total - c)));
                }}
                className="mt-1 w-full text-[14px] px-3 py-2.5 border border-zinc-200 rounded-lg"
              />
            </label>
            <div className="flex justify-between gap-2 mt-5">
              <button
                type="button"
                onClick={() => setPayStep('type')}
                className="text-[13px] font-semibold px-4 py-2 rounded-lg border border-zinc-300 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() =>
                  completeSale('Split', `cash ${splitCash} + card ${splitCard}`)
                }
                className="text-[13px] font-semibold px-5 py-2 rounded-lg bg-zinc-950 text-white cursor-pointer"
              >
                Paid
              </button>
            </div>
          </div>
        </div>
      )}

      <PosInvoice
        open={!!invoiceOrder}
        order={invoiceOrder}
        formatPrice={formatPrice}
        shop={{
          name: shopName,
          address: shopAddress,
          phone: shopPhone,
        }}
        onClose={() => setInvoiceOrder(null)}
      />
    </div>
  );
}
