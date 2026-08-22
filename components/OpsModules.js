'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import DateField from './DateField';
import SearchInput from './SearchInput';
import CatalogPickField from './CatalogPickField';
import { EXPENSE_CATEGORY_OPTIONS } from '../lib/expense-categories';
import SupplierModules from './SupplierModules';
import AccountsModules from './AccountsModules';

const money = (n) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(Number(n || 0));

export default function OpsModules({
  active,
  expenses = [],
  loans = [],
  suppliers = [],
  accounts,
  audit,
  onReload,
  toast
}) {
  const [expenseForm, setExpenseForm] = useState({
    category: 'Shop Rent',
    amount: '',
    description: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    paymentStatus: 'UNPAID',
    reference: ''
  });
  const [expenseQuery, setExpenseQuery] = useState('');
  const [extraExpenseCategories, setExtraExpenseCategories] = useState([]);
  const [expenseCategoryModal, setExpenseCategoryModal] = useState(null);
  const [loanForm, setLoanForm] = useState({
    lender: '',
    amount: '',
    paidAmount: '0',
    loanDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    notes: ''
  });

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('ps_expense_categories') || '[]');
      if (Array.isArray(saved)) setExtraExpenseCategories(saved.filter(Boolean));
    } catch {
      /* ignore */
    }
  }, []);

  const saveExpenseCategory = (name) => {
    const value = String(name || '').trim();
    if (!value) return;
    setExtraExpenseCategories((prev) => {
      const next = [...new Set([...prev, value])];
      try {
        window.localStorage.setItem('ps_expense_categories', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    setExpenseForm((prev) => ({ ...prev, category: value }));
    setExpenseCategoryModal(null);
    toast?.(`${value} added`);
  };

  const submit = async (path, body, reset) => {
    try {
      await api(path, { method: 'POST', body: JSON.stringify(body) });
      toast?.('Saved');
      reset?.();
      await onReload?.();
    } catch (e) {
      toast?.(e.message);
    }
  };

  if (active === 'Expenses') {
    return (
      <section className="module panel">
        <div className="module-head">
          <div>
            <h2>Expense Management</h2>
            <p>Rent, electricity, employee and supplier bills</p>
          </div>
        </div>
        <form
          className="add-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit('/expenses', expenseForm, () => setExpenseForm({ ...expenseForm, amount: '', description: '', reference: '' }));
          }}
        >
          <div className="form-grid">
            <CatalogPickField
              label="Category"
              value={expenseForm.category}
              options={[...EXPENSE_CATEGORY_OPTIONS, ...extraExpenseCategories]}
              emptyLabel="Select category"
              onChange={(category) => setExpenseForm({ ...expenseForm, category })}
              onAdd={() => setExpenseCategoryModal({ name: '' })}
            />
            <label>Amount (£)<input required type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} /></label>
            <label>Date<DateField required value={expenseForm.expenseDate} onChange={(v) => setExpenseForm({ ...expenseForm, expenseDate: v })} /></label>
            <label>Due date<DateField allowClear value={expenseForm.dueDate} onChange={(v) => setExpenseForm({ ...expenseForm, dueDate: v })} /></label>
            <label>Status
              <select value={expenseForm.paymentStatus} onChange={(e) => setExpenseForm({ ...expenseForm, paymentStatus: e.target.value })}>
                <option value="UNPAID">Unpaid</option>
                <option value="PAID">Paid</option>
                <option value="PARTIAL">Partial</option>
              </select>
            </label>
            <label>Reference<input value={expenseForm.reference} onChange={(e) => setExpenseForm({ ...expenseForm, reference: e.target.value })} /></label>
            <label>Note<input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} /></label>
          </div>
          <button className="btn primary" type="submit">Add expense</button>
        </form>
        {expenseCategoryModal && (
          <div className="invoice-overlay" onClick={() => setExpenseCategoryModal(null)}>
            <div className="invoice-card billing-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
              <h2>Add category</h2>
              <p className="modal-sub">Saved on this device so you can pick it on every expense.</p>
              <div className="section-block">
                <label className="full">
                  Category name
                  <input
                    autoFocus
                    value={expenseCategoryModal.name}
                    placeholder="e.g. Shop cleaning"
                    onChange={(e) => setExpenseCategoryModal({ name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveExpenseCategory(expenseCategoryModal.name);
                      }
                    }}
                  />
                </label>
              </div>
              <div className="invoice-actions">
                <button className="btn" type="button" onClick={() => setExpenseCategoryModal(null)}>Cancel</button>
                <button className="btn primary" type="button" onClick={() => saveExpenseCategory(expenseCategoryModal.name)}>
                  Save category
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="filters" style={{ marginBottom: 12 }}>
          <SearchInput value={expenseQuery} onChange={setExpenseQuery} placeholder="Search category, reference, note" />
        </div>
        <div className="data-table">
          <div className="table-head"><span>Date</span><span>Category</span><span>Amount</span><span>Status</span><span>Due</span></div>
          {expenses.filter((e) => {
            const q = expenseQuery.trim().toLowerCase();
            if (!q) return true;
            return [e.category, e.categoryLabel, e.reference, e.description, e.paymentStatus].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
          }).length ? expenses.filter((e) => {
            const q = expenseQuery.trim().toLowerCase();
            if (!q) return true;
            return [e.category, e.categoryLabel, e.reference, e.description, e.paymentStatus].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
          }).map((e) => (
            <div className="table-row" key={e.id}>
              <span>{new Date(e.expenseDate).toLocaleDateString('en-GB')}</span>
              <span>{e.categoryLabel || e.category}</span>
              <b>{money(e.amount)}</b>
              <span>{e.paymentStatus}</span>
              <span>{e.dueDate ? new Date(e.dueDate).toLocaleDateString('en-GB') : '—'}</span>
            </div>
          )) : <div className="empty-table">No expenses yet.</div>}
        </div>
      </section>
    );
  }

  if (active === 'Accounts') {
    return (
      <AccountsModules
        accounts={accounts}
        loans={loans}
        onReload={onReload}
        toast={toast}
        loanForm={loanForm}
        setLoanForm={setLoanForm}
        submitLoan={() => submit('/loans', loanForm, () => setLoanForm({ ...loanForm, lender: '', amount: '', notes: '' }))}
      />
    );
  }

  if (active === 'Suppliers') {
    return <SupplierModules suppliers={suppliers} onReload={onReload} toast={toast} />;
  }

  if (active === 'Audit') {
    return (
      <section className="module panel">
        <div className="module-head">
          <div>
            <h2>Admin activity</h2>
            <p>Last seen, product updates, document and sales actions</p>
          </div>
        </div>
        <div className="data-table" style={{ marginBottom: 16 }}>
          <div className="table-head"><span>Admin</span><span>Last seen</span><span>Last login</span></div>
          {(audit?.admins || []).length ? audit.admins.map((a) => (
            <div className="table-row" key={a.id}>
              <b>{a.name}</b>
              <span>{a.lastSeenAt ? new Date(a.lastSeenAt).toLocaleString('en-GB') : '—'}</span>
              <span>{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('en-GB') : '—'}</span>
            </div>
          )) : <div className="empty-table">No admin presence yet.</div>}
        </div>
        <div className="data-table">
          <div className="table-head"><span>When</span><span>Who</span><span>Action</span><span>Entity</span></div>
          {(audit?.logs || []).length ? audit.logs.map((l) => (
            <div className="table-row" key={l.id}>
              <span>{new Date(l.createdAt).toLocaleString('en-GB')}</span>
              <span>{l.user?.name || '—'}</span>
              <b>{l.action}</b>
              <span>{l.entity}</span>
            </div>
          )) : <div className="empty-table">No audit history in the 3-year window.</div>}
        </div>
      </section>
    );
  }

  return null;
}
