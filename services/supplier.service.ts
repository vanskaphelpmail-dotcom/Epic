import { SupplierLedgerType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { roundMoney } from '@/lib/money';
import { writeAudit } from '@/services/audit.service';
import { notifyAdmins } from '@/services/notify.service';
import { decorateSupplier } from '@/lib/supplier-balance';

function money(n: number) {
  return roundMoney(n);
}

async function recalcSupplier(tx: typeof prisma, supplierId: string) {
  if (!tx.supplierLedgerEntry?.findMany) {
    const row = await tx.supplier.findUniqueOrThrow({ where: { id: supplierId } });
    const due = money(Math.max(0, Number(row.unpaidAmount || 0)));
    return { row, totalPurchase: money(Number(row.paidAmount || 0) + due), paid: money(row.paidAmount), due };
  }
  const entries = await tx.supplierLedgerEntry.findMany({
    where: { supplierId },
    orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }]
  });
  let purchase = 0;
  let paid = 0;
  let latestDue: Date | null = null;
  for (const entry of entries) {
    if (entry.type === 'PURCHASE') {
      purchase += entry.amount;
      if (entry.dueDate) latestDue = entry.dueDate;
    } else {
      paid += entry.amount;
    }
  }
  const due = money(purchase - paid);
  const row = await tx.supplier.update({
    where: { id: supplierId },
    data: {
      paidAmount: money(paid),
      unpaidAmount: due,
      dueDate: due > 0 ? latestDue : null
    }
  });
  return { row, totalPurchase: money(purchase), paid: money(paid), due };
}

function withTotals(supplier: any, totalPurchase?: number) {
  const paid = Number(supplier?.paidAmount || 0);
  const due = Number(supplier?.unpaidAmount || 0);
  return decorateSupplier({
    ...supplier,
    totalPurchase: totalPurchase ?? money(paid + due)
  });
}

export async function listSuppliers(storeId?: string) {
  const rows = await prisma.supplier.findMany({
    where: storeId ? { storeId } : undefined,
    include: { _count: { select: { products: true } } },
    orderBy: { name: 'asc' }
  });
  let sums: Array<{ supplierId: string; type: string; _sum: { amount: number | null } }> = [];
  try {
    sums = await (prisma.supplierLedgerEntry.groupBy as any)({
      by: ['supplierId', 'type'],
      where: storeId ? { storeId } : undefined,
      _sum: { amount: true }
    });
  } catch {
    sums = [];
  }
  const purchaseById = new Map<string, number>();
  for (const row of sums) {
    if (row.type === 'PURCHASE') {
      purchaseById.set(row.supplierId, money(row._sum.amount || 0));
    }
  }
  let lastPays: Array<{ supplierId: string; occurredAt: Date; amount: number }> = [];
  try {
    lastPays = await prisma.supplierLedgerEntry.findMany({
      where: { type: 'PAYMENT', ...(storeId ? { storeId } : {}) },
      orderBy: { occurredAt: 'desc' }
    });
  } catch {
    lastPays = [];
  }
  const lastBySupplier = new Map();
  for (const row of lastPays) {
    if (!lastBySupplier.has(row.supplierId)) lastBySupplier.set(row.supplierId, row);
  }
  return rows.map((s) => ({
    ...withTotals(s, purchaseById.get(s.id)),
    lastPaymentDate: lastBySupplier.get(s.id)?.occurredAt || null,
    lastPaymentAmount: lastBySupplier.get(s.id)?.amount || 0
  }));
}

export async function getSupplier(storeId: string | undefined, id: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id, ...(storeId ? { storeId } : {}) },
    include: {
      _count: { select: { products: true } },
      products: {
        select: { id: true, name: true, barcode: true, stockQuantity: true, purchasePrice: true, lastStockUpdatedAt: true }
      }
    }
  });
  if (!supplier) throw new AppError('NOT_FOUND', 'Supplier not found', 404);
  let ledger: any[] = [];
  try {
    ledger = await prisma.supplierLedgerEntry.findMany({
      where: { supplierId: id },
      include: { user: { select: { name: true } } },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }]
    });
  } catch {
    ledger = [];
  }
  const totalPurchase = money(
    ledger.filter((e) => e.type === 'PURCHASE').reduce((s, e) => s + e.amount, 0)
  );
  return { supplier: withTotals(supplier, totalPurchase), ledger };
}

export async function upsertSupplier(input: {
  storeId: string;
  userId: string;
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  dueDate?: string;
  isActive?: boolean;
  totalPurchase?: number;
  paidAmount?: number;
  unpaidAmount?: number;
  paymentMethod?: string;
  paymentReference?: string;
}) {
  if (!input.name?.trim()) throw new AppError('VALIDATION_ERROR', 'Supplier name is required');
  if (input.id) {
    const row = await prisma.supplier.update({
      where: { id: input.id },
      data: {
        name: input.name.trim(),
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        notes: input.notes || null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        ...(input.isActive == null ? {} : { isActive: input.isActive })
      }
    });
    await writeAudit({
      userId: input.userId,
      storeId: input.storeId,
      action: 'SUPPLIER_UPDATE',
      entity: 'Supplier',
      entityId: row.id
    });
    return withTotals(row);
  }

  const paid = money(input.paidAmount || 0);
  const unpaidHint = money(input.unpaidAmount || 0);
  const purchase = money(input.totalPurchase || paid + unpaidHint);
  const supplier = await prisma.$transaction(async (tx) => {
    const row = await tx.supplier.create({
      data: {
        storeId: input.storeId,
        name: input.name.trim(),
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        notes: input.notes || null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null
      }
    });
    if (purchase > 0) {
      await addLedgerTx(tx, {
        storeId: input.storeId,
        supplierId: row.id,
        userId: input.userId,
        type: 'PURCHASE',
        amount: purchase,
        occurredAt: new Date(),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        notes: input.notes || 'Opening purchase',
        invoiceNumber: input.paymentReference || null
      });
    }
    if (paid > 0) {
      await addLedgerTx(tx, {
        storeId: input.storeId,
        supplierId: row.id,
        userId: input.userId,
        type: 'PAYMENT',
        amount: paid,
        occurredAt: new Date(),
        method: input.paymentMethod || 'CASH',
        reference: input.paymentReference || null,
        notes: input.notes || 'Opening payment'
      });
    }
    await recalcSupplier(tx as unknown as typeof prisma, row.id);
    return tx.supplier.findUniqueOrThrow({ where: { id: row.id } });
  });
  await writeAudit({
    userId: input.userId,
    storeId: input.storeId,
    action: 'SUPPLIER_CREATE',
    entity: 'Supplier',
    entityId: supplier.id
  });
  await notifyAdmins({
    storeId: input.storeId,
    title: 'Supplier added',
    message: `${supplier.name} was added with ${money(purchase).toFixed(2)} purchase and ${paid.toFixed(2)} paid.`,
    type: 'SUPPLIER'
  });
  return withTotals(supplier, purchase);
}

export async function deleteSupplier(input: { storeId: string; userId: string; id: string }) {
  const existing = await prisma.supplier.findFirst({
    where: { id: input.id, storeId: input.storeId },
    include: { _count: { select: { ledgerEntries: true, products: true } } }
  });
  if (!existing) throw new AppError('NOT_FOUND', 'Supplier not found', 404);
  const hasHistory =
    (existing._count?.ledgerEntries || 0) > 0 ||
    (existing._count?.products || 0) > 0 ||
    Number(existing.paidAmount) > 0 ||
    Number(existing.unpaidAmount) > 0;
  if (hasHistory) {
    const row = await prisma.supplier.update({
      where: { id: input.id },
      data: { isActive: false }
    });
    await writeAudit({
      userId: input.userId,
      storeId: input.storeId,
      action: 'SUPPLIER_DEACTIVATE',
      entity: 'Supplier',
      entityId: input.id
    });
    return { ok: true, deactivated: true, supplier: withTotals(row) };
  }
  await prisma.supplier.delete({ where: { id: input.id } });
  await writeAudit({
    userId: input.userId,
    storeId: input.storeId,
    action: 'SUPPLIER_DELETE',
    entity: 'Supplier',
    entityId: input.id
  });
  return { ok: true, deactivated: false };
}

async function addLedgerTx(
  tx: {
    supplier: {
      findUniqueOrThrow: typeof prisma.supplier.findUniqueOrThrow;
      update: typeof prisma.supplier.update;
    };
    supplierLedgerEntry: { create: typeof prisma.supplierLedgerEntry.create };
  },
  input: {
    storeId: string;
    supplierId: string;
    userId: string;
    type: SupplierLedgerType | 'PURCHASE' | 'PAYMENT';
    amount: number;
    occurredAt: Date;
    dueDate?: Date | null;
    method?: string | null;
    reference?: string | null;
    invoiceNumber?: string | null;
    productName?: string | null;
    quantity?: number | null;
    notes?: string | null;
  }
) {
  const amount = money(input.amount);
  if (!(amount > 0)) throw new AppError('VALIDATION_ERROR', 'Amount is required');
  const current = await tx.supplier.findUniqueOrThrow({ where: { id: input.supplierId } });
  const previous = money(current.unpaidAmount);
  const updated = money(input.type === 'PURCHASE' ? previous + amount : previous - amount);
  const applyBalanceOnly = async () => {
    await tx.supplier.update({
      where: { id: input.supplierId },
      data:
        input.type === 'PURCHASE'
          ? { unpaidAmount: updated, dueDate: input.dueDate || current.dueDate }
          : { paidAmount: money(Number(current.paidAmount || 0) + amount), unpaidAmount: Math.max(0, updated) }
    });
    return { id: `bal-${Date.now()}`, previousBalance: previous, updatedBalance: updated };
  };
  if (!tx.supplierLedgerEntry?.create) return applyBalanceOnly();
  try {
    return await tx.supplierLedgerEntry.create({
      data: {
        storeId: input.storeId,
        supplierId: input.supplierId,
        userId: input.userId,
        type: input.type as SupplierLedgerType,
        amount,
        occurredAt: input.occurredAt,
        dueDate: input.dueDate || null,
        method: input.method || null,
        reference: input.reference || null,
        invoiceNumber: input.invoiceNumber || null,
        productName: input.productName || null,
        quantity: input.quantity ?? null,
        notes: input.notes || null,
        previousBalance: previous,
        updatedBalance: updated
      }
    });
  } catch {
    return applyBalanceOnly();
  }
}

export async function addSupplierPurchase(input: {
  storeId: string;
  userId: string;
  supplierId: string;
  amount: number;
  purchaseDate?: string;
  invoiceNumber?: string;
  dueDate?: string;
  productName?: string;
  quantity?: number;
  notes?: string;
}) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: input.supplierId, storeId: input.storeId }
  });
  if (!supplier) throw new AppError('NOT_FOUND', 'Supplier not found', 404);
  const entry = await addLedgerTx(prisma, {
    storeId: input.storeId,
    supplierId: input.supplierId,
    userId: input.userId,
    type: 'PURCHASE',
    amount: Number(input.amount),
    occurredAt: input.purchaseDate ? new Date(input.purchaseDate) : new Date(),
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    invoiceNumber: input.invoiceNumber || null,
    productName: input.productName || null,
    quantity: input.quantity != null ? Number(input.quantity) : null,
    notes: input.notes || null
  });
  await recalcSupplier(prisma, input.supplierId);
  const updated = await prisma.supplier.findUniqueOrThrow({ where: { id: input.supplierId } });
  try {
    if (prisma.accountEntry?.create) {
      await prisma.accountEntry.create({
        data: {
          storeId: input.storeId,
          userId: input.userId,
          type: 'ADJUSTMENT',
          amount: money(input.amount),
          method: 'CASH',
          reference: input.invoiceNumber || entry.id,
          notes: `Supplier purchase · ${supplier.name}`
        }
      });
    }
  } catch {
    /* accounts table optional */
  }
  await writeAudit({
    userId: input.userId,
    storeId: input.storeId,
    action: 'SUPPLIER_PURCHASE',
    entity: 'Supplier',
    entityId: input.supplierId,
    newData: { amount: input.amount }
  }).catch(() => undefined);
  await notifyAdmins({
    storeId: input.storeId,
    title: 'Supplier purchase added',
    message: `${supplier.name}: purchase £${money(input.amount).toFixed(2)}. Due now £${money(updated.unpaidAmount).toFixed(2)}.`,
    type: 'SUPPLIER'
  }).catch(() => undefined);
  return { entry, supplier: withTotals(updated) };
}

export async function addSupplierPayment(input: {
  storeId: string;
  userId: string;
  supplierId: string;
  amount: number;
  paymentDate?: string;
  method?: string;
  accountId?: string;
  reference?: string;
  notes?: string;
}) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: input.supplierId, storeId: input.storeId }
  });
  if (!supplier) throw new AppError('NOT_FOUND', 'Supplier not found', 404);
  const entry = await addLedgerTx(prisma, {
    storeId: input.storeId,
    supplierId: input.supplierId,
    userId: input.userId,
    type: 'PAYMENT',
    amount: Number(input.amount),
    occurredAt: input.paymentDate ? new Date(input.paymentDate) : new Date(),
    method: input.method || 'CASH',
    reference: input.reference || null,
    notes: input.notes || null
  });
  await recalcSupplier(prisma, input.supplierId);
  const updated = await prisma.supplier.findUniqueOrThrow({ where: { id: input.supplierId } });
  try {
    if (prisma.accountEntry?.create) {
      await prisma.accountEntry.create({
        data: {
          storeId: input.storeId,
          userId: input.userId,
          type: 'EXPENSE',
          amount: money(input.amount),
          method: input.method || 'CASH',
          reference: input.reference || entry.id,
          notes: `Supplier payment · ${supplier.name}`
        }
      });
    }
  } catch {
    /* accounts table optional */
  }
  await writeAudit({
    userId: input.userId,
    storeId: input.storeId,
    action: 'SUPPLIER_PAYMENT',
    entity: 'Supplier',
    entityId: input.supplierId,
    newData: { amount: input.amount, method: input.method }
  }).catch(() => undefined);
  await notifyAdmins({
    storeId: input.storeId,
    title: 'Supplier payment recorded',
    message: `${supplier.name}: paid £${money(input.amount).toFixed(2)}. Remaining due £${money(updated.unpaidAmount).toFixed(2)}.`,
    type: 'SUPPLIER'
  }).catch(() => undefined);
  try {
    const { postMoneyEntry } = await import('@/services/money.service');
    await postMoneyEntry({
      storeId: input.storeId,
      userId: input.userId,
      typeKey: 'SUPPLIER_PAYMENT',
      amount: Number(input.amount),
      accountId: input.accountId,
      method: input.method || 'CASH',
      personName: supplier.name,
      reference: input.reference,
      notes: input.notes || `Supplier payment · ${supplier.name}`,
      source: 'SUPPLIER',
      sourceId: entry.id
    });
  } catch {
    /* money ledger is optional if tables are not ready */
  }
  return { entry, supplier: withTotals(updated) };
}

export async function supplierFinanceSummary(storeId?: string) {
  const [purchases, payments, dues, overdue] = await Promise.all([
    prisma.supplierLedgerEntry.aggregate({
      where: { type: 'PURCHASE', ...(storeId ? { storeId } : {}) },
      _sum: { amount: true }
    }),
    prisma.supplierLedgerEntry.aggregate({
      where: { type: 'PAYMENT', ...(storeId ? { storeId } : {}) },
      _sum: { amount: true }
    }),
    prisma.supplier.aggregate({
      where: storeId ? { storeId } : {},
      _sum: { unpaidAmount: true, paidAmount: true }
    }),
    prisma.supplier.aggregate({
      where: {
        unpaidAmount: { gt: 0 },
        dueDate: { lt: new Date() },
        ...(storeId ? { storeId } : {})
      },
      _sum: { unpaidAmount: true },
      _count: true
    })
  ]);
  return {
    supplierPurchases: money(purchases._sum.amount || 0),
    supplierPayments: money(payments._sum.amount || 0),
    supplierDues: money(dues._sum.unpaidAmount || 0),
    overdueSupplierDues: money(overdue._sum.unpaidAmount || 0),
    overdueSupplierCount: overdue._count
  };
}
