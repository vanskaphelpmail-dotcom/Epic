/** Local retail ledger: expenses, accounts, POS till — persists in localStorage */

export type ExpenseStatus = 'Paid' | 'Unpaid';

export interface ShopExpense {
  id: string;
  category: string;
  amount: number;
  date: string;
  dueDate?: string;
  status: ExpenseStatus;
  reference?: string;
  note?: string;
  createdAt: string;
}

export type AccountKind = 'Cash' | 'Bank' | 'bKash' | 'Other';

export interface ShopAccount {
  id: string;
  name: string;
  kind: AccountKind;
  balance: number;
  note?: string;
  updatedAt: string;
}

export interface AccountTxn {
  id: string;
  accountId: string;
  type: 'in' | 'out' | 'transfer';
  amount: number;
  note?: string;
  date: string;
  relatedExpenseId?: string;
}

const EXP_KEY = 'vault_shop_expenses';
const ACC_KEY = 'vault_shop_accounts';
const TXN_KEY = 'vault_shop_account_txns';
const TILL_KEY = 'vault_pos_till';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadExpenses(): ShopExpense[] {
  return readJson<ShopExpense[]>(EXP_KEY, []);
}

export function saveExpenses(list: ShopExpense[]) {
  writeJson(EXP_KEY, list);
}

export function loadAccounts(): ShopAccount[] {
  const list = readJson<ShopAccount[]>(ACC_KEY, []);
  if (list.length) return list;
  const seed: ShopAccount[] = [
    {
      id: 'acc-cash',
      name: 'Till Cash',
      kind: 'Cash',
      balance: 0,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'acc-bank',
      name: 'Main Bank',
      kind: 'Bank',
      balance: 0,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'acc-bkash',
      name: 'bKash',
      kind: 'bKash',
      balance: 0,
      updatedAt: new Date().toISOString(),
    },
  ];
  saveAccounts(seed);
  return seed;
}

export function saveAccounts(list: ShopAccount[]) {
  writeJson(ACC_KEY, list);
}

export function loadTxns(): AccountTxn[] {
  return readJson<AccountTxn[]>(TXN_KEY, []);
}

export function saveTxns(list: AccountTxn[]) {
  writeJson(TXN_KEY, list);
}

export function loadTillCash(): number {
  const n = Number(localStorage.getItem(TILL_KEY));
  return Number.isFinite(n) ? n : 0;
}

export function saveTillCash(amount: number) {
  localStorage.setItem(TILL_KEY, String(Math.max(0, Math.round(amount))));
}

export function addExpense(input: Omit<ShopExpense, 'id' | 'createdAt'>): ShopExpense {
  const row: ShopExpense = {
    ...input,
    id: `exp-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const next = [row, ...loadExpenses()];
  saveExpenses(next);
  if (row.status === 'Paid') {
    applyExpensePayment(row);
  }
  return row;
}

function applyExpensePayment(row: ShopExpense) {
  const accounts = loadAccounts();
  const cash = accounts.find((a) => a.kind === 'Cash') || accounts[0];
  if (!cash) return;
  cash.balance = Math.max(0, cash.balance - row.amount);
  cash.updatedAt = new Date().toISOString();
  saveAccounts(accounts);
  const txns = loadTxns();
  txns.unshift({
    id: `txn-${Date.now()}`,
    accountId: cash.id,
    type: 'out',
    amount: row.amount,
    note: `Expense: ${row.category}`,
    date: row.date,
    relatedExpenseId: row.id,
  });
  saveTxns(txns);
}

export function deleteExpense(id: string) {
  saveExpenses(loadExpenses().filter((e) => e.id !== id));
}

export function recordSaleIntoTill(amount: number, paymentMethod: string) {
  const accounts = loadAccounts();
  const method = paymentMethod.toLowerCase();
  let target =
    method.includes('card') || method.includes('bank')
      ? accounts.find((a) => a.kind === 'Bank')
      : method.includes('bkash') || method.includes('mfs')
        ? accounts.find((a) => a.kind === 'bKash')
        : accounts.find((a) => a.kind === 'Cash');
  if (!target) target = accounts[0];
  if (!target) return;
  target.balance += amount;
  target.updatedAt = new Date().toISOString();
  saveAccounts(accounts);
  if (target.kind === 'Cash') {
    saveTillCash(loadTillCash() + amount);
  }
  const txns = loadTxns();
  txns.unshift({
    id: `txn-${Date.now()}`,
    accountId: target.id,
    type: 'in',
    amount,
    note: `POS sale (${paymentMethod})`,
    date: new Date().toISOString().slice(0, 10),
  });
  saveTxns(txns);
}
