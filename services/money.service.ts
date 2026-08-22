import { randomUUID } from 'crypto';
import { AccountEntryType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { roundMoney } from '@/lib/money';
import { writeAudit } from '@/services/audit.service';
import { startOfDay } from '@/lib/date-range';
import { supplierFinanceSummary } from '@/services/supplier.service';
import {
  DEFAULT_MONEY_ACCOUNTS,
  findMoneyType,
  legacyAccountType
} from '@/lib/money-accounts';

function money(n: number) {
  return roundMoney(n);
}

export async function ensureMoneyAccounts(storeId: string) {
  const existing = await prisma.moneyAccount.count({ where: { storeId } });
  if (existing) return prisma.moneyAccount.findMany({ where: { storeId }, orderBy: { name: 'asc' } });
  await prisma.moneyAccount.createMany({
    data: DEFAULT_MONEY_ACCOUNTS.map((item) => ({
      storeId,
      name: item.name,
      kind: item.kind,
      locationKey: item.locationKey,
      isDefaultCash: !!item.isDefaultCash,
      isDefaultBank: !!item.isDefaultBank
    }))
  });
  return prisma.moneyAccount.findMany({ where: { storeId }, orderBy: { name: 'asc' } });
}

async function cashTotal(storeId: string) {
  const rows = await prisma.moneyAccount.findMany({
    where: { storeId, kind: 'CASH', status: 'ACTIVE' }
  });
  return money(rows.reduce((sum, row) => sum + Number(row.currentBalance || 0), 0));
}

async function bankTotal(storeId: string) {
  const rows = await prisma.moneyAccount.findMany({
    where: { storeId, kind: { in: ['BANK', 'CARD', 'MOBILE', 'GATEWAY'] }, status: 'ACTIVE' }
  });
  return money(rows.reduce((sum, row) => sum + Number(row.currentBalance || 0), 0));
}

export async function ensureDailyCycle(storeId: string) {
  const today = startOfDay(new Date());
  let cycle = await prisma.dailyCashCycle.findUnique({
    where: { storeId_cycleDate: { storeId, cycleDate: today } }
  });
  if (cycle) return cycle;
  const previous = await prisma.dailyCashCycle.findFirst({
    where: { storeId },
    orderBy: { cycleDate: 'desc' }
  });
  const opening = previous?.closingCash != null ? Number(previous.closingCash) : await cashTotal(storeId);
  if (previous && previous.status === 'OPEN') {
    const expected = await cashTotal(storeId);
    await prisma.dailyCashCycle.update({
      where: { id: previous.id },
      data: {
        status: 'CLOSED',
        expectedCash: expected,
        closingCash: previous.actualCash != null ? previous.actualCash : expected,
        cashDifference: previous.actualCash != null ? money(previous.actualCash - expected) : 0,
        closedAt: new Date(),
        summary: buildCycleSummaryPlaceholder(previous.openingCash, expected)
      }
    });
  }
  cycle = await prisma.dailyCashCycle.create({
    data: {
      storeId,
      cycleDate: today,
      openingCash: opening,
      status: 'OPEN'
    }
  });
  return cycle;
}

function buildCycleSummaryPlaceholder(opening: number, expected: number) {
  return { openingCash: opening, expectedCash: expected, autoClosed: true };
}

async function writeLedgerRow(tx: any, input: {
  storeId: string;
  userId: string;
  accountId: string;
  counterpartyAccountId?: string | null;
  transferGroupId?: string | null;
  typeKey: string;
  direction: 'IN' | 'OUT';
  amount: number;
  method?: string | null;
  personName?: string | null;
  personPhone?: string | null;
  reason?: string | null;
  reference?: string | null;
  notes?: string | null;
  occurredAt?: Date;
  source?: string;
  sourceId?: string | null;
}) {
  const amount = money(input.amount);
  if (!(amount > 0)) throw new AppError('VALIDATION_ERROR', 'Amount is required');
  const account = await tx.moneyAccount.findUniqueOrThrow({ where: { id: input.accountId } });
  const signed = input.direction === 'IN' ? amount : -amount;
  const previous = money(account.currentBalance);
  const updated = money(previous + signed);
  const meta = findMoneyType(input.typeKey);
  const entry = await tx.moneyLedgerEntry.create({
    data: {
      storeId: input.storeId,
      userId: input.userId,
      accountId: input.accountId,
      counterpartyAccountId: input.counterpartyAccountId || null,
      transferGroupId: input.transferGroupId || null,
      typeKey: input.typeKey,
      typeLabel: meta.label,
      direction: input.direction,
      amount,
      method: input.method || null,
      personName: input.personName || null,
      personPhone: input.personPhone || null,
      reason: input.reason || null,
      reference: input.reference || null,
      notes: input.notes || null,
      occurredAt: input.occurredAt || new Date(),
      previousBalance: previous,
      updatedBalance: updated,
      source: input.source || 'MANUAL',
      sourceId: input.sourceId || null
    }
  });
  await tx.moneyAccount.update({
    where: { id: account.id },
    data: { currentBalance: updated }
  });
  const legacy = legacyAccountType(input.typeKey, input.direction) as AccountEntryType;
  if (input.source !== 'POS' && input.source !== 'SUPPLIER') {
    await tx.accountEntry.create({
      data: {
        storeId: input.storeId,
        userId: input.userId,
        type: legacy,
        amount,
        method: input.method || 'CASH',
        reference: input.reference || entry.id,
        notes: `${meta.label}${input.personName ? ` · ${input.personName}` : ''}${input.notes ? ` · ${input.notes}` : ''}`
      }
    });
  }
  return entry;
}

export async function postMoneyEntry(input: {
  storeId: string;
  userId: string;
  typeKey: string;
  amount: number;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  method?: string;
  personName?: string;
  personPhone?: string;
  reason?: string;
  reference?: string;
  notes?: string;
  occurredAt?: string;
  source?: string;
  sourceId?: string;
  direction?: 'IN' | 'OUT';
}) {
  await ensureMoneyAccounts(input.storeId);
  const meta = findMoneyType(input.typeKey) as {
    direction?: 'IN' | 'OUT' | 'ADJUST' | 'TRANSFER';
    fields?: string[];
  };
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
  const neededAdjustment = Array.isArray(meta.fields) && meta.fields.includes('adjustment');
  if (neededAdjustment && !String(input.reason || input.notes || '').trim()) {
    throw new AppError('VALIDATION_ERROR', 'Adjustment requires a reason');
  }

  if (meta.direction === 'TRANSFER' || (input.fromAccountId && input.toAccountId)) {
    if (!input.fromAccountId || !input.toAccountId) {
      throw new AppError('VALIDATION_ERROR', 'Choose both From and To accounts');
    }
    if (input.fromAccountId === input.toAccountId) {
      throw new AppError('VALIDATION_ERROR', 'Choose two different accounts');
    }
    const groupId = randomUUID();
    const entries = await prisma.$transaction(async (tx) => {
      const outRow = await writeLedgerRow(tx, {
        ...input,
        accountId: input.fromAccountId!,
        counterpartyAccountId: input.toAccountId,
        transferGroupId: groupId,
        typeKey: input.typeKey,
        direction: 'OUT',
        amount: Number(input.amount),
        occurredAt
      });
      const inRow = await writeLedgerRow(tx, {
        ...input,
        accountId: input.toAccountId!,
        counterpartyAccountId: input.fromAccountId,
        transferGroupId: groupId,
        typeKey: input.typeKey,
        direction: 'IN',
        amount: Number(input.amount),
        occurredAt
      });
      return [outRow, inRow];
    });
    await writeAudit({
      userId: input.userId,
      storeId: input.storeId,
      action: 'MONEY_TRANSFER',
      entity: 'MoneyLedgerEntry',
      entityId: groupId,
      newData: { amount: input.amount, typeKey: input.typeKey }
    });
    return entries[0];
  }

  let accountId = input.accountId;
  if (!accountId) {
    const fallback = await prisma.moneyAccount.findFirst({
      where: {
        storeId: input.storeId,
        ...(meta.direction === 'IN' && /BANK|GATEWAY/.test(input.typeKey)
          ? { isDefaultBank: true }
          : { isDefaultCash: true })
      }
    });
    accountId = fallback?.id;
  }
  if (!accountId) throw new AppError('VALIDATION_ERROR', 'Money location is required');

  let direction: 'IN' | 'OUT' = meta.direction === 'OUT' ? 'OUT' : 'IN';
  if (input.direction === 'IN' || input.direction === 'OUT') direction = input.direction;
  if (meta.direction === 'ADJUST' && !input.direction) {
    direction = 'IN';
  }

  const entry = await prisma.$transaction(async (tx) =>
    writeLedgerRow(tx, {
      ...input,
      accountId,
      typeKey: input.typeKey,
      direction,
      amount: Math.abs(Number(input.amount)),
      occurredAt
    })
  );
  await writeAudit({
    userId: input.userId,
    storeId: input.storeId,
    action: 'MONEY_ENTRY',
    entity: 'MoneyLedgerEntry',
    entityId: entry.id,
    newData: {
      typeKey: input.typeKey,
      amount: entry.amount,
      previousBalance: entry.previousBalance,
      updatedBalance: entry.updatedBalance,
      accountId
    }
  });
  return entry;
}

export async function postPosSaleToLedger(input: {
  storeId: string;
  userId: string;
  amount: number;
  paymentMethod: string;
  invoiceNumber: string;
  paymentStatus: string;
}) {
  if (input.paymentStatus !== 'PAID' || !(Number(input.amount) > 0)) return null;
  try {
    await ensureMoneyAccounts(input.storeId);
    const method = String(input.paymentMethod || 'CASH').toUpperCase();
    const cash = method === 'CASH';
    const account = await prisma.moneyAccount.findFirst({
      where: cash
        ? { storeId: input.storeId, isDefaultCash: true }
        : { storeId: input.storeId, isDefaultBank: true }
    });
    if (!account) return null;
    return postMoneyEntry({
      storeId: input.storeId,
      userId: input.userId,
      typeKey: 'SALES_INCOME',
      amount: Number(input.amount),
      accountId: account.id,
      method,
      reference: input.invoiceNumber,
      notes: 'POS sale',
      source: 'POS',
      sourceId: input.invoiceNumber
    });
  } catch {
    return null;
  }
}

export async function upsertBankAccount(input: {
  storeId: string;
  userId: string;
  id?: string;
  name: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  accountType?: string;
  branch?: string;
  sortCode?: string;
  openingBalance?: number;
  currency?: string;
  status?: string;
  reference?: string;
  notes?: string;
  kind?: string;
}) {
  if (!input.name?.trim()) throw new AppError('VALIDATION_ERROR', 'Account name is required');
  const opening = money(input.openingBalance || 0);
  if (input.id) {
    return prisma.moneyAccount.update({
      where: { id: input.id },
      data: {
        name: input.name.trim(),
        bankName: input.bankName || null,
        accountName: input.accountName || null,
        accountNumber: input.accountNumber || null,
        accountType: input.accountType || null,
        branch: input.branch || null,
        sortCode: input.sortCode || null,
        currency: input.currency || 'GBP',
        status: input.status || 'ACTIVE',
        reference: input.reference || null,
        notes: input.notes || null
      }
    });
  }
  const row = await prisma.moneyAccount.create({
    data: {
      storeId: input.storeId,
      name: input.name.trim(),
      kind: input.kind || 'BANK',
      locationKey: `BANK_${Date.now()}`,
      bankName: input.bankName || input.name.trim(),
      accountName: input.accountName || input.name.trim(),
      accountNumber: input.accountNumber || null,
      accountType: input.accountType || 'Business',
      branch: input.branch || null,
      sortCode: input.sortCode || null,
      currency: input.currency || 'GBP',
      status: input.status || 'ACTIVE',
      reference: input.reference || null,
      notes: input.notes || null,
      openingBalance: opening,
      currentBalance: 0
    }
  });
  if (opening > 0) {
    await postMoneyEntry({
      storeId: input.storeId,
      userId: input.userId,
      typeKey: 'OPENING_BALANCE',
      amount: opening,
      accountId: row.id,
      notes: 'Opening balance',
      source: 'OPENING'
    });
  }
  return prisma.moneyAccount.findUniqueOrThrow({ where: { id: row.id } });
}

export async function recordCashCount(input: {
  storeId: string;
  userId: string;
  actualCash: number;
  note?: string;
}) {
  const cycle = await ensureDailyCycle(input.storeId);
  const expected = await cashTotal(input.storeId);
  const actual = money(input.actualCash);
  const diff = money(actual - expected);
  if (Math.abs(diff) > 0.004 && !String(input.note || '').trim()) {
    throw new AppError('VALIDATION_ERROR', 'Enter a reason when counted cash does not match expected cash');
  }
  const updated = await prisma.dailyCashCycle.update({
    where: { id: cycle.id },
    data: {
      expectedCash: expected,
      actualCash: actual,
      cashDifference: diff,
      differenceNote: input.note || null,
      closingCash: actual
    }
  });
  await writeAudit({
    userId: input.userId,
    storeId: input.storeId,
    action: 'CASH_COUNT',
    entity: 'DailyCashCycle',
    entityId: cycle.id,
    newData: { expected, actual, diff }
  });
  return updated;
}

async function dailyBreakdown(storeId: string, from: Date, to: Date) {
  const rows = await prisma.moneyLedgerEntry.findMany({
    where: { storeId, occurredAt: { gte: from, lte: to } },
    include: { account: true }
  });
  const sum = (keys: string[], cashOnly = false) =>
    money(
      rows
        .filter((row) => keys.includes(row.typeKey) && (!cashOnly || row.account.kind === 'CASH'))
        .reduce((s, row) => s + (row.direction === 'OUT' ? row.amount : row.amount), 0)
    );
  const cashInKeys = ['CASH_IN', 'CASH_RECEIVED', 'MONEY_RECEIVED', 'OTHER_INCOME', 'OWNER_INVESTMENT', 'BUSINESS_CAPITAL'];
  const cashSales = rows.filter((r) => r.typeKey === 'SALES_INCOME' && r.account.kind === 'CASH').reduce((s, r) => s + r.amount, 0);
  const duePay = rows.filter((r) => r.typeKey === 'CUSTOMER_DUE_PAYMENT' && r.account.kind === 'CASH').reduce((s, r) => s + r.amount, 0);
  const customerPay = rows.filter((r) => r.typeKey === 'CUSTOMER_PAYMENT' && r.account.kind === 'CASH').reduce((s, r) => s + r.amount, 0);
  const cashReceived = rows.filter((r) => r.typeKey === 'CASH_RECEIVED').reduce((s, r) => s + r.amount, 0);
  const otherIn = rows.filter((r) => cashInKeys.includes(r.typeKey) && r.account.kind === 'CASH').reduce((s, r) => s + r.amount, 0);
  const expenses = rows.filter((r) => ['EXPENSE_PAYMENT', 'RENT_PAYMENT', 'ELECTRICITY_PAYMENT', 'UTILITY_PAYMENT'].includes(r.typeKey) && r.account.kind === 'CASH').reduce((s, r) => s + r.amount, 0);
  const given = rows.filter((r) => ['CASH_GIVEN', 'MONEY_GIVEN'].includes(r.typeKey)).reduce((s, r) => s + r.amount, 0);
  const supplier = rows.filter((r) => r.typeKey === 'SUPPLIER_PAYMENT' && r.account.kind === 'CASH').reduce((s, r) => s + r.amount, 0);
  const employee = rows.filter((r) => ['EMPLOYEE_PAYMENT', 'EMPLOYEE_ADVANCE', 'EMPLOYEE_LOAN', 'SALARY_PAYMENT'].includes(r.typeKey) && r.account.kind === 'CASH').reduce((s, r) => s + r.amount, 0);
  const deposits = rows.filter((r) => r.typeKey === 'BANK_DEPOSIT' || (r.typeKey === 'CASH_TRANSFER' && r.direction === 'OUT' && r.account.kind === 'CASH')).reduce((s, r) => s + r.amount, 0);
  const otherOut = rows.filter((r) => r.direction === 'OUT' && r.account.kind === 'CASH').reduce((s, r) => s + r.amount, 0);
  const cashIn = rows.filter((r) => r.direction === 'IN' && r.account.kind === 'CASH' && !r.transferGroupId).reduce((s, r) => s + r.amount, 0);
  const cashOut = rows.filter((r) => r.direction === 'OUT' && r.account.kind === 'CASH').reduce((s, r) => s + r.amount, 0);
  void sum;
  return {
    cashReceived: money(cashReceived),
    cashSales: money(cashSales),
    customerDuePayments: money(duePay + customerPay),
    otherCashIn: money(otherIn),
    cashExpenses: money(expenses),
    cashGiven: money(given),
    supplierPayments: money(supplier),
    employeePayments: money(employee),
    bankDeposits: money(deposits),
    otherCashOut: money(Math.max(0, otherOut - expenses - given - supplier - employee - deposits)),
    totalCashIn: money(cashIn),
    totalCashOut: money(cashOut)
  };
}

export async function getMoneyWorkspace(storeId: string, filters?: {
  periodFrom?: Date;
  periodTo?: Date;
  accountId?: string;
  typeKey?: string;
  person?: string;
  method?: string;
}) {
  const accounts = await ensureMoneyAccounts(storeId);
  const cycle = await ensureDailyCycle(storeId);
  const from = filters?.periodFrom;
  const to = filters?.periodTo;
  const entries = await prisma.moneyLedgerEntry.findMany({
    where: {
      storeId,
      ...(from ? { occurredAt: { gte: from, ...(to ? { lte: to } : {}) } } : {}),
      ...(filters?.accountId ? { accountId: filters.accountId } : {}),
      ...(filters?.typeKey ? { typeKey: filters.typeKey } : {}),
      ...(filters?.method ? { method: filters.method } : {}),
      ...(filters?.person ? { personName: { contains: filters.person, mode: 'insensitive' } } : {})
    },
    include: {
      user: { select: { name: true } },
      account: { select: { id: true, name: true, kind: true } }
    },
    orderBy: { occurredAt: 'desc' },
    take: 400
  });
  const today = startOfDay(new Date());
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);
  const breakdown = await dailyBreakdown(storeId, cycle.cycleDate, end);
  const expected = await cashTotal(storeId);
  const cash = expected;
  const bank = await bankTotal(storeId);
  const [salesToday, expensesToday, unpaidSales, supplier] = await Promise.all([
    prisma.sale.aggregate({
      where: { storeId, status: { not: 'VOID' }, saleDate: { gte: today } },
      _sum: { total: true }
    }),
    prisma.expense.aggregate({
      where: { storeId, expenseDate: { gte: today } },
      _sum: { amount: true }
    }),
    prisma.sale.aggregate({
      where: { storeId, status: { not: 'VOID' }, paymentStatus: { in: ['UNPAID', 'PARTIAL', 'PENDING'] } },
      _sum: { total: true }
    }),
    supplierFinanceSummary(storeId).catch(() => ({
      supplierPurchases: 0,
      supplierPayments: 0,
      supplierDues: 0,
      overdueSupplierDues: 0,
      overdueSupplierCount: 0
    }))
  ]);
  const opening = Number(cycle.openingCash || 0);
  const expectedFromCycle = money(opening + breakdown.totalCashIn - breakdown.totalCashOut);
  const dailySummary = {
    openingCash: opening,
    ...breakdown,
    expectedCash: expectedFromCycle,
    actualCash: cycle.actualCash,
    cashDifference: cycle.cashDifference,
    closingCash: cycle.closingCash ?? expected
  };
  return {
    accounts,
    entries,
    cycle: { ...cycle, expectedCash: expectedFromCycle },
    dailySummary,
    summary: {
      cashBalance: cash,
      bankBalance: bank,
      totalBankBalance: bank,
      totalCashIn: breakdown.totalCashIn,
      totalCashOut: breakdown.totalCashOut,
      todayCash: expectedFromCycle,
      todaySales: money(salesToday._sum.total || 0),
      todayExpenses: money(expensesToday._sum.amount || 0),
      customerDue: money(unpaidSales._sum.total || 0),
      supplierDue: supplier.supplierDues,
      netBalance: money(cash + bank),
      totalDue: money((unpaidSales._sum.total || 0) + supplier.supplierDues)
    }
  };
}

export async function listMoneyLedgerRows(storeId: string, range?: { from?: Date; to?: Date }) {
  return prisma.moneyLedgerEntry.findMany({
    where: {
      storeId,
      ...(range?.from ? { occurredAt: { gte: range.from, ...(range.to ? { lte: range.to } : {}) } } : {})
    },
    include: { user: { select: { name: true } }, account: { select: { name: true } } },
    orderBy: { occurredAt: 'desc' },
    take: 2000
  });
}
