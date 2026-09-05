'use client';

import React, { useMemo, useState } from 'react';
import type { Order } from '../../types';
import type { CustomerProfile } from '../AdminPanel';

type Props = {
  customers: CustomerProfile[];
  setCustomers: React.Dispatch<React.SetStateAction<CustomerProfile[]>>;
  orders: Order[];
  formatPrice: (n: number) => string;
};

export function CustomersPanel({ customers, setCustomers, orders, formatPrice }: Props) {
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Merge walk-in / invoice customers not yet in CRM
  const merged = useMemo(() => {
    const map = new Map<string, CustomerProfile>();
    for (const c of customers) {
      map.set(c.id, c);
    }
    for (const o of orders) {
      const phoneKey = o.shippingAddress?.phone || '';
      const nameKey = o.shippingAddress?.fullName || 'Walk-in customer';
      const existing = [...map.values()].find(
        (c) =>
          (phoneKey && phoneKey !== '—' && c.phone === phoneKey) ||
          c.fullName.toLowerCase() === nameKey.toLowerCase(),
      );
      if (existing) continue;
      const id = `inv-${o.id}`;
      if (map.has(id)) continue;
      map.set(id, {
        id,
        fullName: nameKey,
        email: o.shippingAddress?.email || '',
        phone: phoneKey || '—',
        address: o.shippingAddress?.addressLine1 || '—',
        city: o.shippingAddress?.city || '—',
        location: o.shippingAddress?.city || '—',
        ordersCount: 1,
        totalSpent: o.total,
        joinedDate: (o.createdAt || o.date || '').slice(0, 10),
      });
    }
    return [...map.values()];
  }, [customers, orders]);

  const filtered = merged.filter((c) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      c.fullName.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q)
    );
  });

  const persist = (next: CustomerProfile[]) => {
    setCustomers(next);
    localStorage.setItem('vault_saved_customers', JSON.stringify(next));
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPhone('');
    setEmail('');
    setCity('');
    setAddress('');
    setNotes('');
  };

  const saveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editingId) {
      persist(
        customers.map((c) =>
          c.id === editingId
            ? {
                ...c,
                fullName: name.trim(),
                phone: phone.trim() || '—',
                email: email.trim(),
                city: city.trim() || '—',
                location: city.trim() || '—',
                address: address.trim() || '—',
                notes: notes.trim() || undefined,
              }
            : c,
        ),
      );
    } else {
      const row: CustomerProfile = {
        id: `cust-${Date.now()}`,
        fullName: name.trim(),
        phone: phone.trim() || '—',
        email: email.trim(),
        city: city.trim() || '—',
        location: city.trim() || '—',
        address: address.trim() || '—',
        notes: notes.trim() || undefined,
        ordersCount: 0,
        totalSpent: 0,
        joinedDate: new Date().toISOString().slice(0, 10),
      };
      persist([row, ...customers]);
    }
    resetForm();
  };

  const startEdit = (c: CustomerProfile) => {
    setEditingId(c.id);
    setName(c.fullName);
    setPhone(c.phone === '—' ? '' : c.phone);
    setEmail(c.email);
    setCity(c.city === '—' ? '' : c.city);
    setAddress(c.address === '—' ? '' : c.address);
    setNotes(c.notes || '');
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="bg-white border border-zinc-200 rounded-xl p-4">
        <h3 className="text-[15px] font-semibold text-zinc-950 mb-3">
          {editingId ? 'Edit customer' : 'Add customer'}
        </h3>
        <form onSubmit={saveCustomer} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="text-[11px] font-semibold text-zinc-500 uppercase">
            Name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
            />
          </label>
          <label className="text-[11px] font-semibold text-zinc-500 uppercase">
            Mobile
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
            />
          </label>
          <label className="text-[11px] font-semibold text-zinc-500 uppercase">
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
            />
          </label>
          <label className="text-[11px] font-semibold text-zinc-500 uppercase">
            City
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
            />
          </label>
          <label className="text-[11px] font-semibold text-zinc-500 uppercase sm:col-span-2">
            Address
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
            />
          </label>
          <label className="text-[11px] font-semibold text-zinc-500 uppercase sm:col-span-2 lg:col-span-3">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
            />
          </label>
          <div className="flex gap-2 items-end">
            <button
              type="submit"
              className="px-4 py-2.5 rounded-lg bg-zinc-950 text-white text-[13px] font-semibold cursor-pointer"
            >
              {editingId ? 'Save changes' : 'Add customer'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 rounded-lg border border-zinc-300 text-[13px] font-semibold cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100 flex flex-wrap gap-3 items-center justify-between">
          <p className="text-[14px] font-semibold text-zinc-950">
            Customers ({filtered.length} from POS and invoices)
          </p>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, mobile, city…"
            className="text-[13px] px-3 py-2 border border-zinc-200 rounded-lg w-full sm:w-64"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-zinc-50 text-left text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Mobile</th>
                <th className="px-3 py-2 font-semibold">City</th>
                <th className="px-3 py-2 font-semibold">Purchases</th>
                <th className="px-3 py-2 font-semibold">Spent</th>
                <th className="px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2.5 font-medium text-zinc-950">{c.fullName}</td>
                  <td className="px-3 py-2.5">{c.phone || '—'}</td>
                  <td className="px-3 py-2.5">{c.city || '—'}</td>
                  <td className="px-3 py-2.5">{c.ordersCount}</td>
                  <td className="px-3 py-2.5 font-semibold">{formatPrice(c.totalSpent)}</td>
                  <td className="px-3 py-2.5 space-x-2">
                    {!c.id.startsWith('inv-') && (
                      <>
                        <button
                          type="button"
                          className="text-[12px] font-semibold text-zinc-800 cursor-pointer"
                          onClick={() => startEdit(c)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-[12px] font-semibold text-red-600 cursor-pointer"
                          onClick={() => {
                            if (!window.confirm('Delete this customer?')) return;
                            persist(customers.filter((x) => x.id !== c.id));
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
