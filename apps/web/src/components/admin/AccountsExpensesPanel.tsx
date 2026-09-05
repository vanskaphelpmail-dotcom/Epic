'use client';

import React, { useMemo, useState } from 'react';
import {
  addExpense,
  deleteExpense,
  loadAccounts,
  loadExpenses,
  loadTxns,
  saveAccounts,
  type AccountKind,
  type ShopAccount,
  type ShopExpense,
  type ExpenseStatus,
} from '../../lib/retailStore';

type Props = {
  formatPrice: (n: number) => string;
  initialTab?: 'expenses' | 'accounts';
};

const CATEGORIES = [
  'Shop Rent',
  'Utilities',
  'Salaries',
  'Stock Purchase',
  'Marketing',
  'Transport',
  'Maintenance',
  'Other',
];

export function AccountsExpensesPanel({ formatPrice, initialTab = 'expenses' }: Props) {
  const [tab, setTab] = useState<'expenses' | 'accounts'>(initialTab);
  React.useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  const [expenses, setExpenses] = useState<ShopExpense[]>(() => loadExpenses());
  const [accounts, setAccounts] = useState<ShopAccount[]>(() => loadAccounts());
  const [txns, setTxns] = useState(() => loadTxns());
  const [search, setSearch] = useState('');

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<ExpenseStatus>('Unpaid');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  const [accName, setAccName] = useState('');
  const [accKind, setAccKind] = useState<AccountKind>('Cash');
  const [accBalance, setAccBalance] = useState('0');
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmt, setTransferAmt] = useState('');

  const filteredExpenses = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return expenses;
    return expenses.filter(
      (e) =>
        e.category.toLowerCase().includes(q) ||
        (e.reference || '').toLowerCase().includes(q) ||
        (e.note || '').toLowerCase().includes(q),
    );
  }, [expenses, search]);

  const expenseTotals = useMemo(() => {
    const paid = expenses.filter((e) => e.status === 'Paid').reduce((s, e) => s + e.amount, 0);
    const unpaid = expenses.filter((e) => e.status === 'Unpaid').reduce((s, e) => s + e.amount, 0);
    return { paid, unpaid, all: paid + unpaid };
  }, [expenses]);

  const submitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    addExpense({
      category,
      amount: Math.round(n),
      date,
      dueDate: dueDate || undefined,
      status,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
    });
    setExpenses(loadExpenses());
    setAccounts(loadAccounts());
    setTxns(loadTxns());
    setAmount('');
    setReference('');
    setNote('');
    setStatus('Unpaid');
  };

  const addAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;
    const row: ShopAccount = {
      id: `acc-${Date.now()}`,
      name: accName.trim(),
      kind: accKind,
      balance: Number(accBalance) || 0,
      updatedAt: new Date().toISOString(),
    };
    const next = [...accounts, row];
    saveAccounts(next);
    setAccounts(next);
    setAccName('');
    setAccBalance('0');
  };

  const doTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(transferAmt);
    if (!transferFrom || !transferTo || transferFrom === transferTo || !Number.isFinite(amt) || amt <= 0) {
      return;
    }
    const next = accounts.map((a) => {
      if (a.id === transferFrom) return { ...a, balance: a.balance - amt, updatedAt: new Date().toISOString() };
      if (a.id === transferTo) return { ...a, balance: a.balance + amt, updatedAt: new Date().toISOString() };
      return a;
    });
    saveAccounts(next);
    setAccounts(next);
    const list = [
      {
        id: `txn-${Date.now()}`,
        accountId: transferFrom,
        type: 'transfer' as const,
        amount: amt,
        note: `Transfer to ${accounts.find((a) => a.id === transferTo)?.name || transferTo}`,
        date: new Date().toISOString().slice(0, 10),
      },
      ...txns,
    ];
    localStorage.setItem('vault_shop_account_txns', JSON.stringify(list));
    setTxns(list);
    setTransferAmt('');
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex gap-1 bg-zinc-100 p-1 rounded-lg w-fit border border-zinc-200">
        <button
          type="button"
          onClick={() => setTab('expenses')}
          className={`text-[12px] font-semibold px-3 py-1.5 rounded-md cursor-pointer ${
            tab === 'expenses' ? 'bg-zinc-950 text-white' : 'text-zinc-700'
          }`}
        >
          Expenses
        </button>
        <button
          type="button"
          onClick={() => setTab('accounts')}
          className={`text-[12px] font-semibold px-3 py-1.5 rounded-md cursor-pointer ${
            tab === 'accounts' ? 'bg-zinc-950 text-white' : 'text-zinc-700'
          }`}
        >
          Accounts
        </button>
      </div>

      {tab === 'expenses' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-zinc-200 rounded-xl p-4">
              <p className="text-[12px] text-zinc-500">Total expenses</p>
              <p className="text-xl font-bold text-zinc-950">{formatPrice(expenseTotals.all)}</p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl p-4">
              <p className="text-[12px] text-zinc-500">Paid</p>
              <p className="text-xl font-bold text-zinc-950">{formatPrice(expenseTotals.paid)}</p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl p-4">
              <p className="text-[12px] text-zinc-500">Unpaid / due</p>
              <p className="text-xl font-bold text-zinc-950">{formatPrice(expenseTotals.unpaid)}</p>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <h3 className="text-[15px] font-semibold text-zinc-950 mb-3">Add expense</h3>
            <form onSubmit={submitExpense} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="text-[11px] font-semibold text-zinc-500 uppercase">
                Category
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] font-semibold text-zinc-500 uppercase">
                Amount
                <input
                  required
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
                />
              </label>
              <label className="text-[11px] font-semibold text-zinc-500 uppercase">
                Date
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
                />
              </label>
              <label className="text-[11px] font-semibold text-zinc-500 uppercase">
                Due date
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
                />
              </label>
              <label className="text-[11px] font-semibold text-zinc-500 uppercase">
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ExpenseStatus)}
                  className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
                >
                  <option>Unpaid</option>
                  <option>Paid</option>
                </select>
              </label>
              <label className="text-[11px] font-semibold text-zinc-500 uppercase">
                Reference
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
                />
              </label>
              <label className="text-[11px] font-semibold text-zinc-500 uppercase sm:col-span-2">
                Note
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-lg bg-zinc-950 text-white text-[13px] font-semibold cursor-pointer"
                >
                  Add expense
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 flex justify-between gap-2">
              <p className="text-[14px] font-semibold text-zinc-950">Expense list</p>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search category, reference, note…"
                className="text-[13px] px-3 py-1.5 border border-zinc-200 rounded-lg w-56"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-zinc-50 text-left text-zinc-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Date</th>
                    <th className="px-3 py-2 font-semibold">Category</th>
                    <th className="px-3 py-2 font-semibold">Amount</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Due</th>
                    <th className="px-3 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                        No expenses yet.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((e) => (
                      <tr key={e.id}>
                        <td className="px-3 py-2.5">{e.date}</td>
                        <td className="px-3 py-2.5 font-medium text-zinc-950">
                          {e.category}
                          {e.reference ? (
                            <span className="block text-[11px] text-zinc-500">{e.reference}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 font-semibold">{formatPrice(e.amount)}</td>
                        <td className="px-3 py-2.5 uppercase text-[11px] font-semibold">{e.status}</td>
                        <td className="px-3 py-2.5">{e.dueDate || '—'}</td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            className="text-[12px] font-semibold text-red-600 cursor-pointer"
                            onClick={() => {
                              deleteExpense(e.id);
                              setExpenses(loadExpenses());
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'accounts' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {accounts.map((a) => (
              <div key={a.id} className="bg-white border border-zinc-200 rounded-xl p-4">
                <p className="text-[12px] text-zinc-500">
                  {a.kind} · {a.name}
                </p>
                <p className="text-xl font-bold text-zinc-950 mt-1">{formatPrice(a.balance)}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-zinc-200 rounded-xl p-4">
              <h3 className="text-[15px] font-semibold text-zinc-950 mb-3">Add account</h3>
              <form onSubmit={addAccount} className="space-y-3">
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase">
                  Name
                  <input
                    required
                    value={accName}
                    onChange={(e) => setAccName(e.target.value)}
                    className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
                  />
                </label>
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase">
                  Type
                  <select
                    value={accKind}
                    onChange={(e) => setAccKind(e.target.value as AccountKind)}
                    className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
                  >
                    <option>Cash</option>
                    <option>Bank</option>
                    <option>bKash</option>
                    <option>Other</option>
                  </select>
                </label>
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase">
                  Opening balance
                  <input
                    type="number"
                    value={accBalance}
                    onChange={(e) => setAccBalance(e.target.value)}
                    className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
                  />
                </label>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-lg bg-zinc-950 text-white text-[13px] font-semibold cursor-pointer"
                >
                  Add account
                </button>
              </form>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-4">
              <h3 className="text-[15px] font-semibold text-zinc-950 mb-3">Transfer</h3>
              <form onSubmit={doTransfer} className="space-y-3">
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase">
                  From
                  <select
                    value={transferFrom}
                    onChange={(e) => setTransferFrom(e.target.value)}
                    className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
                  >
                    <option value="">Select</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase">
                  To
                  <select
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
                  >
                    <option value="">Select</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase">
                  Amount
                  <input
                    type="number"
                    min={1}
                    value={transferAmt}
                    onChange={(e) => setTransferAmt(e.target.value)}
                    className="mt-1 w-full text-[13px] px-2.5 py-2 border border-zinc-200 rounded-lg font-normal normal-case"
                  />
                </label>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-lg bg-zinc-950 text-white text-[13px] font-semibold cursor-pointer"
                >
                  Transfer
                </button>
              </form>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100">
              <p className="text-[14px] font-semibold text-zinc-950">Recent transactions</p>
            </div>
            <ul className="divide-y divide-zinc-100">
              {txns.length === 0 ? (
                <li className="px-4 py-8 text-center text-[13px] text-zinc-500">No transactions yet.</li>
              ) : (
                txns.slice(0, 40).map((t) => (
                  <li key={t.id} className="px-4 py-3 flex justify-between gap-3 text-[13px]">
                    <div>
                      <p className="font-medium text-zinc-950">
                        {t.type.toUpperCase()} · {accounts.find((a) => a.id === t.accountId)?.name || t.accountId}
                      </p>
                      <p className="text-[12px] text-zinc-500">
                        {t.date} {t.note ? `· ${t.note}` : ''}
                      </p>
                    </div>
                    <p className="font-semibold text-zinc-950">{formatPrice(t.amount)}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
