import { AccountEntryType, ExpenseCategory, PaymentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { roundMoney } from '@/lib/money';
import { writeAudit } from '@/services/audit.service';
import { retentionStart } from '@/lib/date-range';
import { mapExpenseCategory } from '@/lib/expense-categories';
import { supplierFinanceSummary } from '@/services/supplier.service';

export async function listExpenses(storeId?: string) {
  return prisma.expense.findMany({
    where: {
      ...(storeId ? { storeId } : {}),
      expenseDate: { gte: retentionStart() }
    },
    include: { user: { select: { name: true } } },
    orderBy: { expenseDate: 'desc' },
    take: 200
  });
}

export async function createExpense(input: {
  storeId: string;
  userId: string;
  category?: ExpenseCategory | string;
  categoryLabel?: string;
  amount: number;
  description?: string;
  expenseDate?: string;
  dueDate?: string;
  paymentStatus?: PaymentStatus;
  reference?: string;
}) {
  const amount = Number(input.amount);
  if (!(amount >= 0)) throw new AppError('VALIDATION_ERROR', 'Amount is required');
  const categoryLabel = String(input.categoryLabel || input.category || '').trim() || 'Other';
  const category = (Object.values(ExpenseCategory).includes(input.category as ExpenseCategory)
    ? input.category
    : mapExpenseCategory(categoryLabel)) as ExpenseCategory;
  const expense = await prisma.expense.create({
    data: {
      storeId: input.storeId,
      userId: input.userId,
      category: category || 'OTHER',
      categoryLabel,
      amount,
      description: input.description || null,
      expenseDate: input.expenseDate ? new Date(input.expenseDate) : new Date(),
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      paymentStatus: input.paymentStatus || 'UNPAID',
      reference: input.reference || null
    }
  });
  await prisma.accountEntry.create({
    data: {
      storeId: input.storeId,
      userId: input.userId,
      type: 'EXPENSE',
      amount,
      method: 'CASH',
      reference: expense.id,
      notes: input.description || categoryLabel
    }
  });
  await writeAudit({
    userId: input.userId,
    storeId: input.storeId,
    action: 'EXPENSE_CREATE',
    entity: 'Expense',
    entityId: expense.id,
    newData: { amount, category: input.category }
  });
  return expense;
}

export async function listLoans(storeId?: string) {
  return prisma.loan.findMany({
    where: { ...(storeId ? { storeId } : {}) },
    include: { createdBy: { select: { name: true } } },
    orderBy: { loanDate: 'desc' },
    take: 100
  });
}

export async function createLoan(input: {
  storeId: string;
  userId: string;
  lender: string;
  amount: number;
  paidAmount?: number;
  loanDate?: string;
  dueDate?: string;
  notes?: string;
}) {
  const amount = Number(input.amount);
  const paidAmount = Number(input.paidAmount || 0);
  if (!(amount > 0) || !input.lender?.trim()) {
    throw new AppError('VALIDATION_ERROR', 'Lender and amount are required');
  }
  const loan = await prisma.loan.create({
    data: {
      storeId: input.storeId,
      createdById: input.userId,
      lender: input.lender.trim(),
      amount,
      paidAmount,
      remaining: roundMoney(amount - paidAmount),
      loanDate: input.loanDate ? new Date(input.loanDate) : new Date(),
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      notes: input.notes || null
    }
  });
  await prisma.accountEntry.create({
    data: {
      storeId: input.storeId,
      userId: input.userId,
      type: 'LOAN',
      amount,
      method: 'BANK',
      reference: loan.id,
      notes: `Loan from ${loan.lender}`
    }
  });
  await writeAudit({
    userId: input.userId,
    storeId: input.storeId,
    action: 'LOAN_CREATE',
    entity: 'Loan',
    entityId: loan.id
  });
  return loan;
}

export async function listAccountEntries(storeId?: string) {
  return prisma.accountEntry.findMany({
    where: {
      ...(storeId ? { storeId } : {}),
      createdAt: { gte: retentionStart() }
    },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200
  });
}

export async function createAccountEntry(input: {
  storeId: string;
  userId: string;
  type: AccountEntryType;
  amount: number;
  method?: string;
  reference?: string;
  notes?: string;
}) {
  const map: Record<string, string> = {
    CASH_IN: 'CASH_IN',
    CASH_OUT: 'CASH_OUT',
    BANK_IN: 'BANK_DEPOSIT',
    BANK_OUT: 'BANK_WITHDRAWAL',
    SALE: 'SALES_INCOME',
    EXPENSE: 'EXPENSE_PAYMENT',
    LOAN: 'LOAN_RECEIVED',
    OPENING: 'OPENING_BALANCE',
    ADJUSTMENT: 'ADJUSTMENT'
  };
  try {
    const { postMoneyEntry } = await import('@/services/money.service');
    return await postMoneyEntry({
      storeId: input.storeId,
      userId: input.userId,
      typeKey: map[String(input.type)] || 'OTHER',
      amount: Number(input.amount),
      method: input.method,
      reference: input.reference,
      notes: input.notes
    });
  } catch {
    const amount = Number(input.amount);
    if (!(amount >= 0)) throw new AppError('VALIDATION_ERROR', 'Amount is required');
    const entry = await prisma.accountEntry.create({
      data: {
        storeId: input.storeId,
        userId: input.userId,
        type: input.type,
        amount,
        method: input.method || 'CASH',
        reference: input.reference || null,
        notes: input.notes || null
      }
    });
    await writeAudit({
      userId: input.userId,
      storeId: input.storeId,
      action: 'ACCOUNT_ENTRY',
      entity: 'AccountEntry',
      entityId: entry.id,
      newData: { type: input.type, amount }
    });
    return entry;
  }
}

export async function getAccountSummary(storeId?: string) {
  const since = retentionStart();
  const where = { ...(storeId ? { storeId } : {}), createdAt: { gte: since } };
  const [entries, sales, expenses, loans, cash, supplierFinance] = await Promise.all([
    prisma.accountEntry.findMany({ where }),
    prisma.sale.aggregate({
      where: { status: { not: 'VOID' }, paymentStatus: 'PAID', ...(storeId ? { storeId } : {}), saleDate: { gte: since } },
      _sum: { total: true }
    }),
    prisma.expense.aggregate({
      where: { ...(storeId ? { storeId } : {}), expenseDate: { gte: since } },
      _sum: { amount: true }
    }),
    prisma.loan.aggregate({
      where: storeId ? { storeId } : {},
      _sum: { remaining: true, amount: true, paidAmount: true }
    }),
    prisma.cashSession.findFirst({
      where: { ...(storeId ? { storeId } : {}), status: 'OPEN' },
      orderBy: { openedAt: 'desc' }
    }),
    supplierFinanceSummary(storeId).catch(() => ({
      supplierPurchases: 0,
      supplierPayments: 0,
      supplierDues: 0,
      overdueSupplierDues: 0,
      overdueSupplierCount: 0
    }))
  ]);
  const cashIn = entries.filter((e) => ['CASH_IN', 'OPENING'].includes(e.type)).reduce((s, e) => s + e.amount, 0);
  const cashOut = entries.filter((e) => ['CASH_OUT', 'EXPENSE'].includes(e.type)).reduce((s, e) => s + e.amount, 0);
  const bankIn = entries.filter((e) => e.type === 'BANK_IN').reduce((s, e) => s + e.amount, 0);
  const bankOut = entries.filter((e) => e.type === 'BANK_OUT').reduce((s, e) => s + e.amount, 0);
  const saleCash = entries.filter((e) => e.type === 'SALE').reduce((s, e) => s + e.amount, 0);
  const income = Number(sales._sum.total || 0) + cashIn + bankIn;
  const expenseTotal = Number(expenses._sum.amount || 0) + cashOut + bankOut;
  const base = {
    cashBalance: roundMoney((cash?.openingCash || 0) + saleCash + cashIn - cashOut),
    bankBalance: roundMoney(bankIn - bankOut),
    income: roundMoney(income),
    expenses: roundMoney(expenseTotal),
    sales: roundMoney(sales._sum.total || 0),
    profit: roundMoney(income - expenseTotal),
    loansRemaining: roundMoney(loans._sum.remaining || 0),
    cashIn: roundMoney(cashIn),
    cashOut: roundMoney(cashOut),
    openingCash: roundMoney(cash?.openingCash || 0),
    ...supplierFinance
  };
  if (storeId) {
    try {
      const { getMoneyWorkspace } = await import('@/services/money.service');
      const money = await getMoneyWorkspace(storeId);
      return {
        ...base,
        ...money.summary,
        sales: base.sales,
        expenses: base.expenses,
        profit: base.profit,
        loansRemaining: base.loansRemaining,
        ...supplierFinance,
        cashBalance: money.summary.cashBalance,
        bankBalance: money.summary.bankBalance
      };
    } catch {
      return base;
    }
  }
  return base;
}

export async function listAudit(storeId?: string) {
  return prisma.auditLog.findMany({
    where: {
      ...(storeId ? { storeId } : {}),
      createdAt: { gte: retentionStart() }
    },
    include: { user: { select: { id: true, name: true, role: true, lastSeenAt: true, lastLoginAt: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200
  });
}

export async function listAdminPresence(storeId?: string) {
  return prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true, ...(storeId ? { storeId } : {}) },
    select: { id: true, name: true, email: true, lastSeenAt: true, lastLoginAt: true },
    orderBy: { lastSeenAt: 'desc' }
  });
}
