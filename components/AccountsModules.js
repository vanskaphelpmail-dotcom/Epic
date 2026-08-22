'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import {
  DATE_PERIOD_OPTIONS,
  resolvePeriod
} from '../lib/date-range';
import CatalogPickField from './CatalogPickField';
import DateField from './DateField';
import {
  MONEY_TRANSACTION_TYPES,
  PAYMENT_METHODS,
  PERSON_TYPES,
  accountFieldLabel,
  accountsForType,
  findMoneyType,
  partyLabel
} from '../lib/money-accounts';

const money = (n) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(Number(n || 0));

function nowParts() {
  const d = new Date();
  return {
    date: d.toISOString().slice(0, 10),
    time: d.toTimeString().slice(0, 5)
  };
}

const emptyEntry = () => ({
  typeKey: 'CASH_RECEIVED',
  amount: '',
  accountId: '',
  fromAccountId: '',
  toAccountId: '',
  method: 'CASH',
  personName: '',
  personPhone: '',
  reason: '',
  reference: '',
  notes: '',
  date: nowParts().date,
  time: nowParts().time,
  direction: 'IN',
  personType: 'Other Person',
  supplierId: '',
  employeeId: '',
  employeeReason: 'Salary'
});

export default function AccountsModules({ accounts, loans = [], onReload, toast, submitLoan, loanForm, setLoanForm }) {
  const summary = accounts?.summary || {};
  const moneyAccounts = accounts?.accounts || [];
  const entries = accounts?.entries || [];
  const daily = accounts?.dailySummary || {};
  const [form, setForm] = useState(emptyEntry());
  const [extraTypes, setExtraTypes] = useState([]);
  const [typeModal, setTypeModal] = useState(null);
  const [bankOpen, setBankOpen] = useState(false);
  const [bankForm, setBankForm] = useState({
    name: '', bankName: '', accountName: '', accountNumber: '', accountType: 'Business',
    branch: '', sortCode: '', openingBalance: '0', currency: 'GBP', status: 'ACTIVE', reference: '', notes: ''
  });
  const [countForm, setCountForm] = useState({ actualCash: '', note: '' });
  const [filters, setFilters] = useState({ period: 'today', accountId: '', typeKey: '', person: '', method: '' });
  const [partyLists, setPartyLists] = useState({ suppliers: [], staff: [] });

  useEffect(() => {
    api('/suppliers').then((r) => setPartyLists((p) => ({ ...p, suppliers: r.data || [] }))).catch(() => {});
    api('/staff').then((r) => {
      const payload = r.data;
      const staff = Array.isArray(payload) ? payload : payload?.users || [];
      setPartyLists((p) => ({ ...p, staff }));
    }).catch(() => {});
  }, []);

  const typeOptions = useMemo(
    () => [...MONEY_TRANSACTION_TYPES.map((t) => t.label), ...extraTypes],
    [extraTypes]
  );
  const selectedType = findMoneyType(form.typeKey);
  const selectedLabel = selectedType.label;
  const fields = selectedType.fields || [];
  const isTransfer = selectedType.accountKind === 'transfer' || (fields.includes && fields.includes('transfer'));
  const filteredAccounts = accountsForType(moneyAccounts, selectedType);
  const selectedAccount = moneyAccounts.find((a) => a.id === form.accountId);
  const selectedSupplier = partyLists.suppliers.find((s) => s.id === form.supplierId);

  useEffect(() => {
    const list = accountsForType(moneyAccounts, findMoneyType(form.typeKey));
    if (!list.length) return;
    if (!form.accountId || !list.some((a) => a.id === form.accountId)) {
      setForm((prev) => ({ ...prev, accountId: list[0].id }));
    }
  }, [form.typeKey, moneyAccounts]);

  const setTypeByLabel = (label) => {
    const found = MONEY_TRANSACTION_TYPES.find((t) => t.label === label);
    if (found) setForm((prev) => ({ ...prev, typeKey: found.key }));
    else setForm((prev) => ({ ...prev, typeKey: label.replace(/\s+/g, '_').toUpperCase() }));
  };

  const saveType = (name) => {
    const value = String(name || '').trim();
    if (!value) return;
    setExtraTypes((prev) => [...new Set([...prev, value])]);
    setTypeByLabel(value);
    setTypeModal(null);
    toast?.(`${value} added`);
  };

  const saveEntry = async (e) => {
    e.preventDefault();
    try {
      const occurredAt = `${form.date}T${form.time || '00:00'}:00`;
      const personName = selectedType.partyKind === 'supplier' && selectedSupplier
        ? selectedSupplier.name
        : selectedType.partyKind === 'employee'
          ? (partyLists.staff.find((s) => s.id === form.employeeId)?.name || form.personName)
          : form.personType && form.personName
            ? `${form.personType}: ${form.personName}`
            : form.personName;
      if ((form.typeKey === 'SUPPLIER_PAYMENT' || form.typeKey === 'SUPPLIER_DUE_PAYMENT') && form.supplierId) {
        await api(`/suppliers/${form.supplierId}/payments`, {
          method: 'POST',
          body: JSON.stringify({
            amount: Number(form.amount),
            paymentDate: form.date,
            method: form.method,
            accountId: form.accountId,
            reference: form.reference,
            notes: form.notes || form.reason
          })
        });
      } else {
        await api('/accounts', {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            occurredAt,
            personName,
            amount: Number(form.amount),
            accountId: isTransfer ? undefined : form.accountId,
            fromAccountId: isTransfer ? form.fromAccountId : undefined,
            toAccountId: isTransfer ? form.toAccountId : undefined
          })
        });
      }
      toast?.('Entry saved');
      setForm(emptyEntry());
      await onReload?.();
    } catch (err) {
      toast?.(err.message);
    }
  };

  const saveBank = async (e) => {
    e.preventDefault();
    try {
      await api('/accounts/banks', { method: 'POST', body: JSON.stringify(bankForm) });
      toast?.('Bank account saved');
      setBankOpen(false);
      await onReload?.();
    } catch (err) {
      toast?.(err.message);
    }
  };

  const saveCount = async (e) => {
    e.preventDefault();
    try {
      await api('/accounts/count', { method: 'POST', body: JSON.stringify(countForm) });
      toast?.('Cash count recorded');
      setCountForm({ actualCash: '', note: '' });
      await onReload?.();
    } catch (err) {
      toast?.(err.message);
    }
  };

  const downloadHistory = (format) => {
    const params = new URLSearchParams({ type: 'money-ledger', format, period: filters.period });
    window.open(`/api/reports/download?${params.toString()}`, '_blank', 'noopener,noreferrer');
  };

  const cards = [
    ['Cash / Till', summary.cashBalance],
    ['Bank', summary.bankBalance],
    ['Sales', summary.sales],
    ['Expenses', summary.expenses],
    ['Profit', summary.profit],
    ['Loans remaining', summary.loansRemaining],
    ['Total cash in', summary.totalCashIn],
    ['Total cash out', summary.totalCashOut],
    ['Total bank balance', summary.totalBankBalance],
    ['Total due', summary.totalDue],
    ['Supplier due', summary.supplierDue],
    ['Customer due', summary.customerDue],
    ["Today's cash", summary.todayCash],
    ["Today's sales", summary.todaySales],
    ["Today's expenses", summary.todayExpenses],
    ['Net balance', summary.netBalance]
  ];

  return (
    <section className="module panel">
      <div className="module-head">
        <div>
          <h2>Account Management</h2>
          <p>Cash, bank, money in/out and balances from the transaction ledger</p>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        {cards.map(([label, value]) => (
          <div className="stat-card" key={label}><span>{label}</span><strong>{money(value)}</strong></div>
        ))}
      </div>

      <h3 style={{ margin: '8px 0 12px', fontSize: 16 }}>Daily cash cycle</h3>
      <div className="stats" style={{ marginBottom: 16 }}>
        {[
          ['Opening cash', daily.openingCash],
          ['Cash received', daily.cashReceived],
          ['Cash sales', daily.cashSales],
          ['Customer due payments', daily.customerDuePayments],
          ['Other cash in', daily.otherCashIn],
          ['Cash expenses', daily.cashExpenses],
          ['Cash given', daily.cashGiven],
          ['Supplier payments', daily.supplierPayments],
          ['Employee payments', daily.employeePayments],
          ['Bank deposits', daily.bankDeposits],
          ['Other cash out', daily.otherCashOut],
          ['Expected cash', daily.expectedCash],
          ['Actual cash', daily.actualCash],
          ['Cash difference', daily.cashDifference],
          ['Closing cash', daily.closingCash]
        ].map(([label, value]) => (
          <div className="stat-card" key={label}><span>{label}</span><strong>{value == null ? '—' : money(value)}</strong></div>
        ))}
      </div>

      <form className="add-form" onSubmit={saveCount}>
        <div className="form-grid">
          <label>Physical cash count (£)
            <input required type="number" step="0.01" value={countForm.actualCash} onChange={(e) => setCountForm({ ...countForm, actualCash: e.target.value })} />
          </label>
          <label>Difference reason
            <input value={countForm.note} placeholder="Required if count does not match" onChange={(e) => setCountForm({ ...countForm, note: e.target.value })} />
          </label>
        </div>
        <button className="btn" type="submit">Record cash count</button>
      </form>

      <form className="add-form" onSubmit={saveEntry}>
        <div className="form-grid">
          <CatalogPickField
            label="Transaction type"
            value={selectedLabel}
            options={typeOptions}
            emptyLabel="Select type"
            onChange={setTypeByLabel}
            onAdd={() => setTypeModal({ name: '' })}
          />
          <label>Amount (£)
            <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </label>
          {isTransfer ? (
            <>
              <label>From account
                <select required value={form.fromAccountId} onChange={(e) => setForm({ ...form, fromAccountId: e.target.value })}>
                  <option value="">Select…</option>
                  {moneyAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {money(a.currentBalance)}</option>)}
                </select>
              </label>
              <label>To account
                <select required value={form.toAccountId} onChange={(e) => setForm({ ...form, toAccountId: e.target.value })}>
                  <option value="">Select…</option>
                  {moneyAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {money(a.currentBalance)}</option>)}
                </select>
              </label>
            </>
          ) : (
            <label>{accountFieldLabel(selectedType)}
              <select required value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                <option value="">Select…</option>
                {filteredAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {money(a.currentBalance)}</option>)}
              </select>
            </label>
          )}
          {selectedAccount && !isTransfer && (
            <div className="account-hint">
              {selectedAccount.name}
              {selectedAccount.bankName ? ` · ${selectedAccount.bankName}` : ''}
              {selectedAccount.accountName ? ` · ${selectedAccount.accountName}` : ''}
              {selectedAccount.accountNumber ? ` · ****${String(selectedAccount.accountNumber).slice(-4)}` : ''}
              {` · ${selectedAccount.kind} · balance ${money(selectedAccount.currentBalance)}`}
            </div>
          )}
          {selectedType.partyKind === 'supplier' && (
            <label>{partyLabel(selectedType)}
              <select required value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value, personName: partyLists.suppliers.find((s) => s.id === e.target.value)?.name || '' })}>
                <option value="">Select supplier…</option>
                {partyLists.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} · due {money(s.unpaidAmount)}</option>
                ))}
              </select>
            </label>
          )}
          {selectedSupplier && (
            <div className="account-hint">
              {selectedSupplier.name} · purchase {money(selectedSupplier.totalPurchase)} · paid {money(selectedSupplier.paidAmount)} · due {money(selectedSupplier.unpaidAmount)}
              {selectedSupplier.dueDate ? ` · due ${new Date(selectedSupplier.dueDate).toLocaleDateString('en-GB')}` : ''}
            </div>
          )}
          {selectedType.partyKind === 'employee' && (
            <>
              <label>{partyLabel(selectedType)}
                <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                  <option value="">Select employee…</option>
                  {partyLists.staff.map((s) => <option key={s.id} value={s.id}>{s.name}{s.employeeId ? ` · ${s.employeeId}` : ''}</option>)}
                </select>
              </label>
              <label>Payment type
                <select value={form.employeeReason} onChange={(e) => setForm({ ...form, employeeReason: e.target.value, reason: e.target.value })}>
                  {['Salary', 'Advance', 'Loan', 'Bonus', 'Allowance', 'Reimbursement', 'Other'].map((r) => <option key={r}>{r}</option>)}
                </select>
              </label>
            </>
          )}
          {(selectedType.partyKind === 'receivedFrom' || selectedType.partyKind === 'givenTo' || selectedType.partyKind === 'owner' || selectedType.partyKind === 'customer') && (
            <>
              <label>{partyLabel(selectedType)}
                <select value={form.personType} onChange={(e) => setForm({ ...form, personType: e.target.value })}>
                  {PERSON_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label>Person name
                <input required value={form.personName} onChange={(e) => setForm({ ...form, personName: e.target.value })} />
              </label>
            </>
          )}
          <label>Payment method
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              {PAYMENT_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </label>
          {(fields.includes('phone') || selectedType.partyKind) && selectedType.partyKind !== 'supplier' && selectedType.partyKind !== 'employee' && (
            <label>Phone number
              <input value={form.personPhone} onChange={(e) => setForm({ ...form, personPhone: e.target.value })} />
            </label>
          )}
          {(fields.includes('reason') || fields.includes('adjustment')) && (
            <label>{fields.includes('adjustment') ? 'Adjustment reason' : 'Reason'}
              <input required={fields.includes('adjustment')} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </label>
          )}
          {form.typeKey === 'ADJUSTMENT' && (
            <label>Direction
              <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                <option value="IN">Add to account</option>
                <option value="OUT">Deduct from account</option>
              </select>
            </label>
          )}
          <label>Date<DateField value={form.date} onChange={(v) => setForm({ ...form, date: v })} /></label>
          <label>Time<input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
          <label>Reference<input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></label>
          <label>Note<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        </div>
        <button className="btn primary" type="submit">Add entry</button>
      </form>

      <div className="module-head" style={{ marginTop: 8 }}>
        <h3 style={{ fontSize: 16 }}>Bank account management</h3>
        <button className="btn" type="button" onClick={() => setBankOpen((v) => !v)}>{bankOpen ? 'Close' : 'Add bank account'}</button>
      </div>
      {bankOpen && (
        <form className="add-form" onSubmit={saveBank}>
          <div className="form-grid">
            <label>Account name<input required value={bankForm.name} placeholder="e.g. HSBC Business Account" onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })} /></label>
            <label>Bank name<input value={bankForm.bankName} onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })} /></label>
            <label>Account holder<input value={bankForm.accountName} onChange={(e) => setBankForm({ ...bankForm, accountName: e.target.value })} /></label>
            <label>Account number<input value={bankForm.accountNumber} onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })} /></label>
            <label>Account type<input value={bankForm.accountType} onChange={(e) => setBankForm({ ...bankForm, accountType: e.target.value })} /></label>
            <label>Branch<input value={bankForm.branch} onChange={(e) => setBankForm({ ...bankForm, branch: e.target.value })} /></label>
            <label>Sort code / routing<input value={bankForm.sortCode} onChange={(e) => setBankForm({ ...bankForm, sortCode: e.target.value })} /></label>
            <label>Opening balance (£)<input type="number" min="0" step="0.01" value={bankForm.openingBalance} onChange={(e) => setBankForm({ ...bankForm, openingBalance: e.target.value })} /></label>
            <label>Currency<input value={bankForm.currency} onChange={(e) => setBankForm({ ...bankForm, currency: e.target.value })} /></label>
            <label>Status
              <select value={bankForm.status} onChange={(e) => setBankForm({ ...bankForm, status: e.target.value })}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <label>Reference<input value={bankForm.reference} onChange={(e) => setBankForm({ ...bankForm, reference: e.target.value })} /></label>
            <label>Notes<input value={bankForm.notes} onChange={(e) => setBankForm({ ...bankForm, notes: e.target.value })} /></label>
          </div>
          <button className="btn primary" type="submit">Save bank account</button>
        </form>
      )}
      <div className="sheet-wrap" style={{ marginBottom: 16 }}>
        <table className="sheet" style={{ minWidth: 860 }}>
          <thead>
            <tr>
              <th>Account</th><th>Kind</th><th>Number</th><th className="num">Opening</th>
              <th className="num">Current</th><th>Status</th><th>Currency</th><th>Branch</th>
            </tr>
          </thead>
          <tbody>
            {moneyAccounts.length ? moneyAccounts.map((a) => (
              <tr key={a.id}>
                <td><b>{a.name}</b>{a.bankName ? <span className="muted">{a.bankName}</span> : null}</td>
                <td>{a.kind}</td>
                <td>{a.accountNumber ? `****${String(a.accountNumber).slice(-4)}` : '—'}</td>
                <td className="num">{money(a.openingBalance)}</td>
                <td className="num">{money(a.currentBalance)}</td>
                <td>{a.status}</td>
                <td>{a.currency}</td>
                <td>{a.branch || a.sortCode || '—'}</td>
              </tr>
            )) : <tr><td colSpan={8} className="empty-table">Accounts will appear after the first load.</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 style={{ marginTop: 24 }}>Loan management</h3>
      <form
        className="add-form"
        onSubmit={(e) => {
          e.preventDefault();
          submitLoan?.();
        }}
      >
        <div className="form-grid">
          <label>Lender<input required value={loanForm.lender} onChange={(e) => setLoanForm({ ...loanForm, lender: e.target.value })} /></label>
          <label>Amount (£)<input required type="number" min="0" step="0.01" value={loanForm.amount} onChange={(e) => setLoanForm({ ...loanForm, amount: e.target.value })} /></label>
          <label>Paid (£)<input type="number" min="0" step="0.01" value={loanForm.paidAmount} onChange={(e) => setLoanForm({ ...loanForm, paidAmount: e.target.value })} /></label>
          <label>Loan date<DateField value={loanForm.loanDate} onChange={(v) => setLoanForm({ ...loanForm, loanDate: v })} /></label>
          <label>Due date<DateField allowClear value={loanForm.dueDate} onChange={(v) => setLoanForm({ ...loanForm, dueDate: v })} /></label>
        </div>
        <button className="btn primary" type="submit">Add loan</button>
      </form>
      <div className="data-table">
        <div className="table-head"><span>Lender</span><span>Amount</span><span>Paid</span><span>Remaining</span><span>Due</span></div>
        {loans.length ? loans.map((l) => (
          <div className="table-row" key={l.id}>
            <b>{l.lender}</b>
            <span>{money(l.amount)}</span>
            <span>{money(l.paidAmount)}</span>
            <span>{money(l.remaining)}</span>
            <span>{l.dueDate ? new Date(l.dueDate).toLocaleDateString('en-GB') : '—'}</span>
          </div>
        )) : <div className="empty-table">No loans.</div>}
      </div>

      <div className="module-head" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 16 }}>Transaction history</h3>
        <div className="row-actions">
          <button className="btn-text" type="button" onClick={() => downloadHistory('pdf')}>PDF</button>
          <button className="btn-text" type="button" onClick={() => downloadHistory('excel')}>Excel</button>
        </div>
      </div>
      <div className="inv-filters" style={{ marginBottom: 12 }}>
        {DATE_PERIOD_OPTIONS.filter((o) => ['today', 'yesterday', 'last7', 'thisMonth', 'thisYear', 'custom'].includes(o.value)).map((o) => (
          <button key={o.value} type="button" className="btn" onClick={() => setFilters({ ...filters, period: o.value })}>
            {o.label}
          </button>
        ))}
      </div>
      <p className="subhead">{resolvePeriod(filters.period).label} · historical rows are never deleted when the daily cycle resets</p>
      <div className="sheet-wrap">
        <table className="sheet" style={{ minWidth: 1080 }}>
          <thead>
            <tr>
              <th>Date</th><th>Type</th><th>Account</th><th>Source / recipient</th><th>In / Out</th>
              <th className="num">Amount</th><th>Method</th><th className="num">Previous</th><th className="num">Updated</th><th>By / notes</th>
            </tr>
          </thead>
          <tbody>
            {entries.length ? entries.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.occurredAt || e.createdAt).toLocaleString('en-GB')}</td>
                <td>{e.typeLabel || e.type}</td>
                <td>{e.account?.name || '—'}</td>
                <td>{e.personName || '—'}</td>
                <td>{e.direction || (['CASH_IN', 'BANK_IN', 'SALE', 'OPENING'].includes(e.type) ? 'IN' : 'OUT')}</td>
                <td className="num">{money(e.amount)}</td>
                <td>{e.method || '—'}</td>
                <td className="num">{e.previousBalance != null ? money(e.previousBalance) : '—'}</td>
                <td className="num">{e.updatedBalance != null ? money(e.updatedBalance) : '—'}</td>
                <td>{e.user?.name || '—'}{e.notes || e.reason ? <span className="muted">{e.reference || e.notes || e.reason}</span> : null}</td>
              </tr>
            )) : <tr><td colSpan={10} className="empty-table">No account history yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {typeModal && (
        <div className="invoice-overlay" onClick={() => setTypeModal(null)}>
          <div className="invoice-card billing-modal" onClick={(ev) => ev.stopPropagation()} style={{ maxWidth: 440 }}>
            <h2>Add transaction type</h2>
            <p className="modal-sub">Shown on this device so you can pick it next time.</p>
            <label className="full">
              Type name
              <input autoFocus value={typeModal.name} onChange={(ev) => setTypeModal({ name: ev.target.value })} />
            </label>
            <div className="invoice-actions">
              <button className="btn" type="button" onClick={() => setTypeModal(null)}>Cancel</button>
              <button className="btn primary" type="button" onClick={() => saveType(typeModal.name)}>Save type</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
