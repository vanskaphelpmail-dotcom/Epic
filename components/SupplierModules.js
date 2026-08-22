'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { decorateSupplier } from '../lib/supplier-balance';
import DateField from './DateField';

const money = (n) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(Number(n || 0));

const emptyForm = () => ({
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  companyName: '',
  totalPurchase: '',
  paidAmount: '0',
  unpaidAmount: '0',
  dueDate: '',
  paymentMethod: 'CASH',
  paymentReference: '',
  notes: '',
  isActive: true
});

function computedUnpaid(form) {
  const purchase = Number(form.totalPurchase || 0);
  const paid = Number(form.paidAmount || 0);
  const fallback = Number(form.unpaidAmount || 0);
  if (purchase > 0) return Math.max(0, Math.round((purchase - paid) * 100) / 100);
  return fallback;
}

function SupplierRowActions({ onPick }) {
  const [open, setOpen] = useState(false);
  const items = [
    ['view', 'View'],
    ['purchase', 'Add Purchase'],
    ['payment', 'Add Payment'],
    ['history', 'History'],
    ['edit', 'Edit'],
    ['delete', 'Delete']
  ];
  return (
    <div className="supplier-row-actions">
      <div className="supplier-row-actions-inline">
        {items.map(([id, label], i) => (
          <span key={id} className="supplier-action-item">
            {i > 0 ? <span className="action-sep" aria-hidden="true">·</span> : null}
            <button
              type="button"
              className={`btn-text ${id === 'delete' ? 'danger' : ''}`}
              onClick={() => onPick(id)}
            >
              {label}
            </button>
          </span>
        ))}
      </div>
      <div className="supplier-row-actions-more">
        <button type="button" className="btn" onClick={() => setOpen((v) => !v)}>More</button>
        {open && (
          <div className="sale-actions-menu" role="menu">
            {items.concat([['pdf', 'Download PDF'], ['excel', 'Download Excel']]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onPick(id);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SupplierModules({ suppliers = [], onReload, toast }) {
  const [supplierForm, setSupplierForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [payForm, setPayForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    method: 'CASH',
    accountId: '',
    reference: '',
    notes: ''
  });
  const [buyForm, setBuyForm] = useState({
    amount: '',
    paidAmount: '0',
    purchaseDate: new Date().toISOString().slice(0, 10),
    invoiceNumber: '',
    dueDate: '',
    productName: '',
    quantity: '',
    notes: ''
  });
  const remainingPreview = useMemo(() => computedUnpaid(supplierForm), [supplierForm]);
  const [rows, setRows] = useState(suppliers);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [moneyAccounts, setMoneyAccounts] = useState([]);
  useEffect(() => { setRows(suppliers); }, [suppliers]);
  useEffect(() => {
    api('/accounts').then((r) => setMoneyAccounts(r.data?.accounts || [])).catch(() => {});
  }, []);

  const refreshList = async () => {
    const res = await api('/suppliers');
    setRows(res.data || []);
    await onReload?.();
  };

  const loadDetail = async (id) => {
    try {
      const res = await api(`/suppliers/${id}`);
      setDetail(res.data);
      return res.data;
    } catch (err) {
      toast?.(err.message);
      return null;
    }
  };

  const submitSupplier = async (e) => {
    e.preventDefault();
    try {
      await api('/suppliers', {
        method: 'POST',
        body: JSON.stringify({
          ...supplierForm,
          id: editingId || undefined,
          isActive: editingId ? supplierForm.isActive !== false : true,
          notes: [supplierForm.companyName && `Company: ${supplierForm.companyName}`, supplierForm.city && `City: ${supplierForm.city}`, supplierForm.notes]
            .filter(Boolean)
            .join(' · ')
        })
      });
      toast?.(editingId ? 'Supplier updated' : 'Supplier saved');
      setSupplierForm(emptyForm());
      setEditingId(null);
      await refreshList();
    } catch (err) {
      toast?.(err.message);
    }
  };

  const openEdit = (s) => {
    const notes = String(s.notes || '');
    const company = notes.match(/Company:\s*([^·]+)/)?.[1]?.trim() || s.companyName || '';
    const city = notes.match(/City:\s*([^·]+)/)?.[1]?.trim() || s.city || '';
    setEditingId(s.id);
    setSupplierForm({
      ...emptyForm(),
      name: s.name || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      companyName: company,
      city,
      notes: notes.replace(/Company:\s*[^·]+·?\s*/g, '').replace(/City:\s*[^·]+·?\s*/g, '').trim(),
      dueDate: s.dueDate ? new Date(s.dueDate).toISOString().slice(0, 10) : '',
      isActive: s.isActive !== false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const savePayment = async () => {
    try {
      await api(`/suppliers/${modal.supplier.id}/payments`, { method: 'POST', body: JSON.stringify(payForm) });
      toast?.('Payment recorded');
      setModal(null);
      await refreshList();
      if (detail?.supplier?.id === modal.supplier.id) await loadDetail(modal.supplier.id);
    } catch (err) {
      toast?.(err.message);
    }
  };

  const savePurchase = async () => {
    try {
      await api(`/suppliers/${modal.supplier.id}/purchases`, { method: 'POST', body: JSON.stringify(buyForm) });
      const paidNow = Number(buyForm.paidAmount || 0);
      if (paidNow > 0) {
        await api(`/suppliers/${modal.supplier.id}/payments`, {
          method: 'POST',
          body: JSON.stringify({
            amount: paidNow,
            paymentDate: buyForm.purchaseDate,
            method: 'CASH',
            notes: `Paid with purchase ${buyForm.invoiceNumber || ''}`.trim()
          })
        });
      }
      toast?.('Purchase added');
      setModal(null);
      await refreshList();
      if (detail?.supplier?.id === modal.supplier.id) await loadDetail(modal.supplier.id);
    } catch (err) {
      toast?.(err.message);
    }
  };

  const removeSupplier = async (s) => {
    if (!window.confirm(`Remove ${s.name}? Suppliers with purchases or payments are marked Inactive instead of deleted.`)) return;
    try {
      const res = await api(`/suppliers/${s.id}`, { method: 'DELETE' });
      toast?.(res.data?.deactivated ? 'Supplier marked inactive' : 'Supplier deleted');
      if (detail?.supplier?.id === s.id) setDetail(null);
      await refreshList();
    } catch (err) {
      toast?.(err.message);
    }
  };

  const downloadSupplier = (s, format, kind = 'all') => {
    window.open(`/api/suppliers/${s.id}/export?format=${format}&kind=${kind}`, '_blank', 'noopener,noreferrer');
  };

  const runAction = async (id, s) => {
    if (id === 'view') {
      setModal({ type: 'view', supplier: s });
      await loadDetail(s.id);
      return;
    }
    if (id === 'history') {
      setModal({ type: 'history', supplier: s });
      await loadDetail(s.id);
      return;
    }
    if (id === 'purchase') {
      setBuyForm({ amount: '', paidAmount: '0', purchaseDate: new Date().toISOString().slice(0, 10), invoiceNumber: '', dueDate: '', productName: '', quantity: '', notes: '' });
      setModal({ type: 'purchase', supplier: s });
      return;
    }
    if (id === 'payment') {
      setPayForm({
        amount: '',
        paymentDate: new Date().toISOString().slice(0, 10),
        method: 'CASH',
        accountId: moneyAccounts.find((a) => a.isDefaultCash)?.id || '',
        reference: '',
        notes: ''
      });
      setModal({ type: 'payment', supplier: s });
      return;
    }
    if (id === 'edit') {
      openEdit(s);
      return;
    }
    if (id === 'pdf') {
      downloadSupplier(s, 'pdf');
      return;
    }
    if (id === 'excel') {
      downloadSupplier(s, 'excel');
      return;
    }
    if (id === 'delete') removeSupplier(s);
  };

  const listed = rows.filter((s) => {
    const row = decorateSupplier(s);
    const q = search.trim().toLowerCase();
    if (q && ![s.name, s.phone, s.email, s.notes].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))) return false;
    if (filter === 'inactive') return s.isActive === false;
    if (s.isActive === false && filter !== 'inactive') return false;
    if (filter === 'paid') return row.status === 'Paid';
    if (filter === 'partial') return row.status === 'Partially Paid';
    if (filter === 'unpaid') return row.status === 'Unpaid';
    if (filter === 'soon') return row.status === 'Due Soon';
    if (filter === 'overdue') return row.status === 'Overdue';
    if (filter === 'hasDue') return Number(row.unpaidAmount) > 0;
    if (filter === 'noDue') return Number(row.unpaidAmount) <= 0;
    return true;
  });

  const cards = {
    count: listed.length,
    purchase: listed.reduce((s, r) => s + Number(r.totalPurchase || 0), 0),
    paid: listed.reduce((s, r) => s + Number(r.paidAmount || 0), 0),
    due: listed.reduce((s, r) => s + Number(r.unpaidAmount || 0), 0),
    overdue: listed.filter((r) => decorateSupplier(r).status === 'Overdue').length,
    soon: listed.filter((r) => decorateSupplier(r).status === 'Due Soon').length,
    outstanding: listed.filter((r) => Number(r.unpaidAmount) > 0).length
  };

  const openPay = (s) => {
    setPayForm({
      amount: '',
      paymentDate: new Date().toISOString().slice(0, 10),
      method: 'CASH',
      accountId: moneyAccounts.find((a) => a.isDefaultCash)?.id || '',
      reference: '',
      notes: ''
    });
    setModal({ type: 'payment', supplier: s });
  };

  return (
    <section className="module panel">
      <div className="module-head">
        <div>
          <h2>Suppliers / Vendors</h2>
          <p>Purchases, payments and due balances from the supplier ledger</p>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat-card"><span>Suppliers</span><strong>{cards.count}</strong></div>
        <div className="stat-card"><span>Total purchases</span><strong>{money(cards.purchase)}</strong></div>
        <div className="stat-card"><span>Total paid</span><strong>{money(cards.paid)}</strong></div>
        <div className="stat-card"><span>Current due</span><strong>{money(cards.due)}</strong></div>
        <div className="stat-card"><span>Overdue</span><strong>{cards.overdue}</strong></div>
        <div className="stat-card"><span>Due soon</span><strong>{cards.soon}</strong></div>
        <div className="stat-card"><span>With balance</span><strong>{cards.outstanding}</strong></div>
      </div>

      <form className="add-form" onSubmit={submitSupplier}>
        <div className="form-grid">
          <label>Supplier name<input required value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} /></label>
          <label>Phone number<input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} /></label>
          <label>Email<input value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} /></label>
          <label>Address<input value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} /></label>
          {!editingId && (
            <>
              <label>Total purchase (£)<input type="number" min="0" step="0.01" value={supplierForm.totalPurchase} onChange={(e) => setSupplierForm({ ...supplierForm, totalPurchase: e.target.value })} /></label>
              <label>Paid amount (£)<input type="number" min="0" step="0.01" value={supplierForm.paidAmount} onChange={(e) => setSupplierForm({ ...supplierForm, paidAmount: e.target.value })} /></label>
              <label>Current due (£)<input readOnly value={remainingPreview} /></label>
            </>
          )}
          <label>Due date<DateField allowClear value={supplierForm.dueDate} onChange={(v) => setSupplierForm({ ...supplierForm, dueDate: v })} /></label>
          <label>Company name<input value={supplierForm.companyName} onChange={(e) => setSupplierForm({ ...supplierForm, companyName: e.target.value })} /></label>
          <label>City<input value={supplierForm.city} onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })} /></label>
          <label>Notes<input value={supplierForm.notes} onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })} /></label>
          {editingId && (
            <label>Status
              <select
                value={supplierForm.isActive === false ? 'inactive' : 'active'}
                onChange={(e) => setSupplierForm({ ...supplierForm, isActive: e.target.value === 'active' })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          )}
        </div>
        <div className="row-actions">
          <button className="btn primary" type="submit">{editingId ? 'Update supplier' : 'Save supplier'}</button>
          {editingId && <button className="btn" type="button" onClick={() => { setEditingId(null); setSupplierForm(emptyForm()); }}>Cancel edit</button>}
        </div>
      </form>

      <div className="filters" style={{ marginBottom: 12 }}>
        {[
          ['all', 'All'],
          ['hasDue', 'Has due'],
          ['noDue', 'No due'],
          ['paid', 'Paid'],
          ['partial', 'Partially paid'],
          ['unpaid', 'Unpaid'],
          ['soon', 'Due soon'],
          ['overdue', 'Overdue'],
          ['inactive', 'Inactive']
        ].map(([id, label]) => (
          <button key={id} type="button" className={`chip ${filter === id ? 'active' : ''}`} onClick={() => setFilter(id)}>{label}</button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone or notes" style={{ minWidth: 200, border: '1px solid var(--line)', borderRadius: 999, padding: '8px 14px' }} />
      </div>

      <div className="sheet-wrap supplier-sheet-wrap">
        <table className="sheet supplier-sheet">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Phone</th>
              <th className="num">Total purchase</th>
              <th className="num">Paid</th>
              <th className="num">Current due</th>
              <th className="num">Products</th>
              <th>Due date</th>
              <th>Status</th>
              <th>Last payment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {listed.length ? listed.map((s) => {
              const row = decorateSupplier(s);
              return (
                <tr key={s.id}>
                  <td><b>{s.name}</b></td>
                  <td>{s.phone || '—'}</td>
                  <td className="num">{money(row.totalPurchase)}</td>
                  <td className="num">{money(row.paidAmount)}</td>
                  <td className="num">{money(row.unpaidAmount)}</td>
                  <td className="num">{s._count?.products ?? 0}</td>
                  <td>{s.dueDate ? new Date(s.dueDate).toLocaleDateString('en-GB') : '—'}</td>
                  <td>{row.status}</td>
                  <td>
                    {s.lastPaymentAmount != null && Number(s.lastPaymentAmount) > 0
                      ? money(s.lastPaymentAmount)
                      : '—'}
                    {s.lastPaymentDate ? <span className="muted">{new Date(s.lastPaymentDate).toLocaleDateString('en-GB')}</span> : null}
                  </td>
                  <td className="supplier-actions-cell">
                    <SupplierRowActions onPick={(id) => runAction(id, decorateSupplier(s))} />
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={10} className="empty-table">No suppliers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal?.type === 'payment' && (
        <div className="invoice-overlay" onClick={() => setModal(null)}>
          <div className="invoice-card billing-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h2>Add payment</h2>
            <p className="modal-sub">
              {modal.supplier.name} · Current due: {money(modal.supplier.unpaidAmount)}
              {payForm.amount ? ` · new due ${money(Math.max(0, Number(modal.supplier.unpaidAmount || 0) - Number(payForm.amount || 0)))}` : ''}
            </p>
            <div className="form-grid">
              <label>Supplier<input readOnly value={modal.supplier.name} /></label>
              <label>Payment amount (£)<input required type="number" min="0.01" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></label>
              <label>Payment date<DateField value={payForm.paymentDate} onChange={(v) => setPayForm({ ...payForm, paymentDate: v })} /></label>
              <label>Payment method
                <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CARD">Card</option>
                  <option value="BKASH">bKash</option>
                  <option value="NAGAD">Nagad</option>
                  <option value="ROCKET">Rocket</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label>Bank / cash account
                <select value={payForm.accountId} onChange={(e) => setPayForm({ ...payForm, accountId: e.target.value })}>
                  <option value="">Default for method</option>
                  {moneyAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {money(a.currentBalance)}</option>)}
                </select>
              </label>
              <label>Reference<input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} /></label>
              <label>Notes<input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} /></label>
            </div>
            <div className="invoice-actions">
              <button className="btn" type="button" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn primary" type="button" onClick={savePayment}>Save payment</button>
            </div>
          </div>
        </div>
      )}

      {modal?.type === 'purchase' && (
        <div className="invoice-overlay" onClick={() => setModal(null)}>
          <div className="invoice-card billing-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h2>Add purchase</h2>
            <p className="modal-sub">{modal.supplier.name} · remaining due after this purchase: {money(Math.max(0, Number(buyForm.amount || 0) - Number(buyForm.paidAmount || 0)))}</p>
            <div className="form-grid">
              <label>Supplier<input readOnly value={modal.supplier.name} /></label>
              <label>Purchase amount (£)<input required type="number" min="0.01" step="0.01" value={buyForm.amount} onChange={(e) => setBuyForm({ ...buyForm, amount: e.target.value })} /></label>
              <label>Paid now (£)<input type="number" min="0" step="0.01" value={buyForm.paidAmount} onChange={(e) => setBuyForm({ ...buyForm, paidAmount: e.target.value })} /></label>
              <label>Remaining due (£)<input readOnly value={Math.max(0, Number(buyForm.amount || 0) - Number(buyForm.paidAmount || 0))} /></label>
              <label>Purchase date<DateField value={buyForm.purchaseDate} onChange={(v) => setBuyForm({ ...buyForm, purchaseDate: v })} /></label>
              <label>Invoice number<input value={buyForm.invoiceNumber} onChange={(e) => setBuyForm({ ...buyForm, invoiceNumber: e.target.value })} /></label>
              <label>Due date<DateField allowClear value={buyForm.dueDate} onChange={(v) => setBuyForm({ ...buyForm, dueDate: v })} /></label>
              <label>Product(s)<input value={buyForm.productName} onChange={(e) => setBuyForm({ ...buyForm, productName: e.target.value })} /></label>
              <label>Quantity<input type="number" min="0" step="1" value={buyForm.quantity} onChange={(e) => setBuyForm({ ...buyForm, quantity: e.target.value })} /></label>
              <label>Notes<input value={buyForm.notes} onChange={(e) => setBuyForm({ ...buyForm, notes: e.target.value })} /></label>
            </div>
            <div className="invoice-actions">
              <button className="btn" type="button" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn primary" type="button" onClick={savePurchase}>Save purchase</button>
            </div>
          </div>
        </div>
      )}

      {(modal?.type === 'view' || modal?.type === 'history') && detail && (
        <div className="invoice-overlay" onClick={() => { setModal(null); setDetail(null); }}>
          <div className="invoice-card billing-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860 }}>
            <h2>{modal.type === 'history' ? `${detail.supplier.name} · History` : detail.supplier.name}</h2>
            <p className="modal-sub">
              {detail.supplier.phone || 'No phone'}
              {detail.supplier.email ? ` · ${detail.supplier.email}` : ''}
              {detail.supplier.address ? ` · ${detail.supplier.address}` : ''}
              {' · '}
              {decorateSupplier(detail.supplier).status}
              {' · '}
              {detail.supplier.isActive === false ? 'Inactive' : 'Active'}
              {detail.supplier.dueDate ? ` · Due ${new Date(detail.supplier.dueDate).toLocaleDateString('en-GB')}` : ''}
            </p>
            <div className="stats" style={{ marginBottom: 16 }}>
              <div className="stat-card"><span>Total purchase</span><strong>{money(detail.supplier.totalPurchase)}</strong></div>
              <div className="stat-card"><span>Total paid</span><strong>{money(detail.supplier.paidAmount)}</strong></div>
              <div className="stat-card"><span>Current due</span><strong>{money(detail.supplier.unpaidAmount)}</strong></div>
              <div className="stat-card"><span>Current balance</span><strong>{money(detail.supplier.unpaidAmount)}</strong></div>
            </div>
            {(detail.supplier.products || []).length ? (
              <p className="modal-sub">Products: {detail.supplier.products.map((p) => `${p.name} (${p.stockQuantity})`).join(', ')}</p>
            ) : <p className="modal-sub">Products: none linked</p>}
            <h3 style={{ fontSize: 15, margin: '12px 0 8px' }}>{modal.type === 'history' ? 'Complete money flow' : 'Purchase, payment and due history'}</h3>
            <div className="sheet-wrap">
              <table className="sheet" style={{ minWidth: 860 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th className="num">Amount</th>
                    <th>Method</th>
                    <th className="num">Previous balance</th>
                    <th className="num">New balance</th>
                    <th>Reference</th>
                    <th>Added by</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.ledger || []).length ? detail.ledger.map((e) => (
                    <tr key={e.id}>
                      <td>{new Date(e.occurredAt || e.createdAt).toLocaleString('en-GB')}</td>
                      <td>{e.type === 'PURCHASE' ? 'Purchase / due' : e.type === 'PAYMENT' ? 'Payment' : e.type}</td>
                      <td className="num">{money(e.amount)}</td>
                      <td>{e.method || '—'}</td>
                      <td className="num">{money(e.previousBalance)}</td>
                      <td className="num">{money(e.updatedBalance)}</td>
                      <td>{e.reference || e.notes || '—'}</td>
                      <td>{e.user?.name || '—'}</td>
                    </tr>
                  )) : <tr><td colSpan={8}>No history yet.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="invoice-actions">
              <button className="btn" type="button" onClick={() => downloadSupplier(detail.supplier, 'pdf')}>Download PDF</button>
              <button className="btn" type="button" onClick={() => downloadSupplier(detail.supplier, 'excel')}>Download Excel</button>
              <button className="btn" type="button" onClick={() => { setModal(null); setDetail(null); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
