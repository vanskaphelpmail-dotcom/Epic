import ExcelJS from 'exceljs';
import { prisma, prismaDelegate } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { formatDateRangeLabel, resolvePeriod as resolveDatePeriod } from '@/lib/date-range';
import { buildStructuredExcel, buildStructuredPdf } from '@/lib/report-export';

export type ReportPeriod = string;

export function resolvePeriod(
  period?: string | null,
  customFrom?: string | null,
  customTo?: string | null
): {
  from?: Date;
  to?: Date;
  label: string;
} {
  return resolveDatePeriod(period, customFrom, customTo);
}

type RangeOpts = {
  period?: string | null;
  from?: string | null;
  to?: string | null;
};

function stamp(name: string, period: string, ext: 'xlsx' | 'pdf' = 'xlsx') {
  const date = new Date().toISOString().slice(0, 10);
  const safe = `${name}-${period}-${date}`
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${safe}.${ext}`;
}

export async function buildStockExcel(storeId?: string, periodOrOpts?: string | null | RangeOpts) {
  const opts = typeof periodOrOpts === 'object' && periodOrOpts ? periodOrOpts : { period: periodOrOpts };
  const range = resolvePeriod(opts.period, opts.from, opts.to);
  const products = await prisma.product.findMany({
    where: {
      ...(storeId ? { storeId } : {}),
      isActive: true,
      ...(range.from
        ? {
            OR: [
              { updatedAt: { gte: range.from, lte: range.to } },
              { createdAt: { gte: range.from, lte: range.to } }
            ]
          }
        : {})
    },
    include: { store: true },
    orderBy: { name: 'asc' }
  });

  // If period filter returned nothing (e.g. no updates), fall back to full stock.
  const rows =
    products.length || !range.from
      ? products
      : await prisma.product.findMany({
          where: { ...(storeId ? { storeId } : {}), isActive: true },
          include: { store: true },
          orderBy: { name: 'asc' }
        });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Stock Report');
  sheet.columns = [
    { header: 'Product Name', key: 'name', width: 36 },
    { header: 'SKU', key: 'sku', width: 14 },
    { header: 'Barcode', key: 'barcode', width: 12 },
    { header: 'Brand', key: 'brand', width: 16 },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Current Stock', key: 'stock', width: 14 },
    { header: 'Purchase Cost', key: 'cost', width: 14 },
    { header: 'Selling Price', key: 'price', width: 14 },
    { header: 'Profit Per Unit', key: 'profit', width: 14 },
    { header: 'Profit %', key: 'profitPct', width: 12 },
    { header: 'Stock Cost Value', key: 'stockCost', width: 16 },
    { header: 'Potential Sales Value', key: 'salesValue', width: 18 },
    { header: 'Potential Profit', key: 'potentialProfit', width: 16 },
    { header: 'Minimum Stock', key: 'min', width: 14 },
    { header: 'Stock Status', key: 'status', width: 14 },
    { header: 'Period', key: 'period', width: 12 }
  ];

  for (const p of rows) {
    const profit = p.sellingPrice - p.purchasePrice;
    const profitPct = p.purchasePrice > 0 ? (profit / p.purchasePrice) * 100 : 0;
    sheet.addRow({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      brand: p.brand,
      category: p.category,
      stock: p.stockQuantity,
      cost: p.purchasePrice,
      price: p.sellingPrice,
      profit,
      profitPct: Number(profitPct.toFixed(2)),
      stockCost: p.stockQuantity * p.purchasePrice,
      salesValue: p.stockQuantity * p.sellingPrice,
      potentialProfit: p.stockQuantity * profit,
      min: p.minimumStock,
      status: p.stockQuantity <= p.minimumStock ? 'LOW' : 'OK',
      period: range.label
    });
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: 'P1' };
  return { buffer: await workbook.xlsx.writeBuffer(), filename: stamp('stock-report', range.label) };
}

export async function buildSalesExcel(storeId?: string, periodOrOpts?: string | null | RangeOpts) {
  const opts = typeof periodOrOpts === 'object' && periodOrOpts ? periodOrOpts : { period: periodOrOpts };
  const range = resolvePeriod(opts.period, opts.from, opts.to);
  const sales = await prisma.sale.findMany({
    where: {
      ...(storeId ? { storeId } : {}),
      ...(range.from
        ? { saleDate: { gte: range.from, lte: range.to } }
        : {})
    },
    include: { staff: true, customer: true, items: true },
    orderBy: { saleDate: 'desc' },
    take: 5000
  });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sales Report');
  sheet.columns = [
    { header: 'Invoice', key: 'invoice', width: 16 },
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Staff', key: 'staff', width: 18 },
    { header: 'Customer', key: 'customer', width: 18 },
    { header: 'Items', key: 'items', width: 10 },
    { header: 'Subtotal', key: 'subtotal', width: 12 },
    { header: 'VAT', key: 'tax', width: 10 },
    { header: 'Total', key: 'total', width: 12 },
    { header: 'Payment', key: 'payment', width: 14 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Period', key: 'period', width: 12 }
  ];
  for (const s of sales) {
    sheet.addRow({
      invoice: s.invoiceNumber,
      date: s.saleDate.toISOString(),
      staff: s.staff?.name,
      customer: s.customer?.name || 'Walk-in',
      items: s.items.length,
      subtotal: s.subtotal,
      tax: s.tax,
      total: s.total,
      payment: s.paymentMethod,
      status: s.status,
      period: range.label
    });
  }
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return { buffer: await workbook.xlsx.writeBuffer(), filename: stamp('sales-report', range.label) };
}

export async function buildAttendanceExcel(storeId?: string, periodOrOpts?: string | null | RangeOpts) {
  const opts = typeof periodOrOpts === 'object' && periodOrOpts ? periodOrOpts : { period: periodOrOpts };
  const range = resolvePeriod(opts.period, opts.from, opts.to);
  const rows = await prisma.attendance.findMany({
    where: {
      ...(storeId ? { storeId } : {}),
      ...(range.from ? { date: { gte: range.from, lte: range.to } } : {})
    },
    include: { user: true, cashSession: true },
    orderBy: { date: 'desc' },
    take: 5000
  });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Attendance');
  sheet.columns = [
    { header: 'Employee', key: 'employee', width: 20 },
    { header: 'Employee ID', key: 'employeeId', width: 14 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Clock In', key: 'in', width: 20 },
    { header: 'Clock Out', key: 'out', width: 20 },
    { header: 'Working Hours', key: 'hours', width: 14 },
    { header: 'Opening Cash', key: 'open', width: 14 },
    { header: 'Closing Cash', key: 'close', width: 14 },
    { header: 'Expected Cash', key: 'expected', width: 14 },
    { header: 'Cash Difference', key: 'diff', width: 14 },
    { header: 'Period', key: 'period', width: 12 }
  ];
  for (const r of rows) {
    sheet.addRow({
      employee: r.user?.name,
      employeeId: r.user?.employeeId,
      date: r.date.toISOString().slice(0, 10),
      in: r.clockIn?.toISOString() || '',
      out: r.clockOut?.toISOString() || '',
      hours: Number(((r.workMinutes || 0) / 60).toFixed(2)),
      open: r.openingCash ?? r.cashSession?.openingCash ?? '',
      close: r.closingCash ?? r.cashSession?.closingCash ?? '',
      expected: r.expectedCash ?? r.cashSession?.expectedCash ?? '',
      diff: r.cashDiff ?? r.cashSession?.cashDifference ?? '',
      period: range.label
    });
  }
  return {
    buffer: await workbook.xlsx.writeBuffer(),
    filename: stamp('attendance-report', range.label)
  };
}

export async function buildSalaryExcel(storeId?: string, periodOrOpts?: string | null | RangeOpts) {
  const opts = typeof periodOrOpts === 'object' && periodOrOpts ? periodOrOpts : { period: periodOrOpts };
  const range = resolvePeriod(opts.period, opts.from, opts.to);
  const rows = await prisma.salaryRecord.findMany({
    where: {
      ...(storeId ? { storeId } : {}),
      ...(range.from
        ? {
            OR: [
              { periodStart: { gte: range.from, lte: range.to } },
              { periodEnd: { gte: range.from, lte: range.to } }
            ]
          }
        : {})
    },
    include: { user: true },
    orderBy: { periodStart: 'desc' }
  });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Salary');
  sheet.columns = [
    { header: 'Employee', key: 'employee', width: 20 },
    { header: 'Period Start', key: 'start', width: 14 },
    { header: 'Period End', key: 'end', width: 14 },
    { header: 'Working Days', key: 'days', width: 14 },
    { header: 'Working Hours', key: 'hours', width: 14 },
    { header: 'Base Salary', key: 'base', width: 12 },
    { header: 'Calculated', key: 'calc', width: 12 },
    { header: 'Paid', key: 'paid', width: 12 },
    { header: 'Due', key: 'due', width: 12 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Filter', key: 'period', width: 12 }
  ];
  for (const r of rows) {
    sheet.addRow({
      employee: r.user?.name,
      start: r.periodStart.toISOString().slice(0, 10),
      end: r.periodEnd.toISOString().slice(0, 10),
      days: r.workingDays,
      hours: r.workingHours,
      base: r.baseSalary,
      calc: r.calculatedSalary,
      paid: r.paidAmount,
      due: r.dueAmount,
      status: r.paymentStatus,
      period: range.label
    });
  }
  return {
    buffer: await workbook.xlsx.writeBuffer(),
    filename: stamp('salary-report', range.label)
  };
}

function moneyNum(n: unknown) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function dateLabel(d?: Date | string | null) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? '' : x.toLocaleDateString('en-GB');
}

function timeLabel(d?: Date | string | null) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? '' : x.toLocaleString('en-GB');
}

type ReportColumn = { key: string; label: string; kind?: 'text' | 'money' | 'num' | 'date' };

export type OpsReportPayload = {
  type: string;
  title: string;
  periodLabel: string;
  columns: ReportColumn[];
  rows: Array<Record<string, unknown>>;
  summaries: Array<{ label: string; value: string | number }>;
  totalAmount: number;
};

function sumKey(rows: Array<Record<string, unknown>>, key: string) {
  return moneyNum(rows.reduce((s, r) => s + Number(r[key] || 0), 0));
}

function payload(
  type: string,
  title: string,
  periodLabel: string,
  columns: ReportColumn[],
  rows: Array<Record<string, unknown>>,
  summaries: Array<{ label: string; value: string | number }>,
  totalKey?: string
): OpsReportPayload {
  return {
    type,
    title,
    periodLabel,
    columns,
    rows,
    summaries,
    totalAmount: totalKey ? sumKey(rows, totalKey) : 0
  };
}

async function buildTypedReport(
  type: string,
  storeId: string | undefined,
  range: { from?: Date; to?: Date; label: string }
): Promise<OpsReportPayload> {
  const from = range.from;
  const to = range.to;
  const dateWhere = from ? { gte: from, ...(to ? { lte: to } : {}) } : undefined;
  const store = storeId ? { storeId } : {};
  const periodLabel = range.label;

  switch (type) {
    case 'expenses': {
      const data = await prisma.expense.findMany({
        where: { ...store, ...(dateWhere ? { expenseDate: dateWhere } : {}) },
        include: { user: true },
        take: 2000,
        orderBy: { expenseDate: 'desc' }
      });
      const rows = data.map((e) => ({
        date: dateLabel(e.expenseDate),
        category: (e as { categoryLabel?: string }).categoryLabel || e.category,
        amount: moneyNum(e.amount),
        status: e.paymentStatus,
        method: '',
        reference: e.reference || e.description || '',
        by: e.user?.name || ''
      }));
      const paid = rows.filter((r) => String(r.status).toUpperCase() === 'PAID');
      return payload(type, 'Expense Report', periodLabel, [
        { key: 'date', label: 'Date', kind: 'date' },
        { key: 'category', label: 'Type' },
        { key: 'amount', label: 'Amount', kind: 'money' },
        { key: 'status', label: 'Status' },
        { key: 'method', label: 'Method' },
        { key: 'reference', label: 'Reference' },
        { key: 'by', label: 'Recorded by' }
      ], rows, [
        { label: 'Total expenses', value: sumKey(rows, 'amount') },
        { label: 'Paid', value: sumKey(paid, 'amount') },
        { label: 'Pending', value: sumKey(rows.filter((r) => String(r.status).toUpperCase() !== 'PAID'), 'amount') },
        { label: 'Number of expenses', value: rows.length }
      ], 'amount');
    }
    case 'loans': {
      const data = await prisma.loan.findMany({ where: store, take: 500, orderBy: { createdAt: 'desc' } });
      const rows = data.map((l) => ({
        lender: l.lender,
        amount: moneyNum(l.amount),
        paid: moneyNum(l.paidAmount),
        remaining: moneyNum(l.remaining),
        due: dateLabel(l.dueDate)
      }));
      return payload(type, 'Loan Report', periodLabel, [
        { key: 'lender', label: 'Lender' },
        { key: 'amount', label: 'Amount', kind: 'money' },
        { key: 'paid', label: 'Paid', kind: 'money' },
        { key: 'remaining', label: 'Remaining', kind: 'money' },
        { key: 'due', label: 'Due date', kind: 'date' }
      ], rows, [
        { label: 'Total loans', value: sumKey(rows, 'amount') },
        { label: 'Paid', value: sumKey(rows, 'paid') },
        { label: 'Remaining', value: sumKey(rows, 'remaining') },
        { label: 'Records', value: rows.length }
      ], 'remaining');
    }
    case 'unpaid-sales':
    case 'sales':
    case 'sales-history':
    case 'income':
    case 'customer-payment-history': {
      const unpaidOnly = type === 'unpaid-sales';
      const paidOnly = type === 'customer-payment-history';
      const data = await prisma.sale.findMany({
        where: {
          status: { not: 'VOID' },
          ...store,
          ...(dateWhere ? { saleDate: dateWhere } : {}),
          ...(unpaidOnly ? { paymentStatus: { in: ['UNPAID', 'PARTIAL'] } } : {}),
          ...(paidOnly ? { paymentStatus: { in: ['PAID', 'PARTIAL'] } } : {})
        },
        include: { staff: true, customer: true, items: true },
        take: 2000,
        orderBy: { saleDate: 'desc' }
      });
      const rows = data.map((s) => ({
        invoice: s.invoiceNumber,
        date: timeLabel(s.saleDate),
        staff: s.staff?.name || '',
        customer: s.customer?.name || 'Walk-in',
        items: s.items?.length || 0,
        total: moneyNum(s.total),
        paid: moneyNum(s.paidAmount ?? (s.paymentStatus === 'PAID' ? s.total : 0)),
        method: s.paymentMethod,
        status: s.paymentStatus,
        channel: s.channel
      }));
      const paidRows = rows.filter((r) => String(r.status) === 'PAID');
      const unpaidRows = rows.filter((r) => String(r.status) !== 'PAID');
      const title =
        type === 'unpaid-sales' ? 'Unpaid Sales Report'
          : type === 'customer-payment-history' ? 'Customer Payment History Report'
            : type === 'income' ? 'Income Report'
              : type === 'sales-history' ? 'Sales History Report'
                : 'Sales Report';
      return payload(type, title, periodLabel, [
        { key: 'invoice', label: 'Invoice' },
        { key: 'date', label: 'Date', kind: 'date' },
        { key: 'staff', label: 'Employee' },
        { key: 'customer', label: 'Customer' },
        { key: 'items', label: 'Items', kind: 'num' },
        { key: 'total', label: 'Amount', kind: 'money' },
        { key: 'paid', label: 'Paid', kind: 'money' },
        { key: 'method', label: 'Method' },
        { key: 'status', label: 'Status' }
      ], rows, [
        { label: 'Total sales', value: sumKey(rows, 'total') },
        { label: 'Paid sales', value: sumKey(paidRows, 'total') },
        { label: 'Unpaid sales', value: sumKey(unpaidRows, 'total') },
        { label: 'Number of orders', value: rows.length },
        { label: 'Average order', value: rows.length ? moneyNum(sumKey(rows, 'total') / rows.length) : 0 }
      ], 'total');
    }
    case 'money':
    case 'money-ledger':
    case 'cash-management':
    case 'bank-transactions': {
      const ledger = prismaDelegate('moneyLedgerEntry');
      const accountEntries = prismaDelegate('accountEntry');
      let rows: Array<Record<string, unknown>> = [];
      if (ledger) {
        const kindFilter =
          type === 'cash-management' ? { account: { kind: 'CASH' as const } }
            : type === 'bank-transactions' ? { account: { kind: { in: ['BANK', 'CARD', 'MOBILE', 'GATEWAY'] as const } } }
              : {};
        const data = await ledger.findMany({
          where: { ...store, ...(dateWhere ? { occurredAt: dateWhere } : {}), ...kindFilter },
          include: { user: true, account: true },
          take: 3000,
          orderBy: { occurredAt: 'desc' }
        });
        rows = data.map((e: any) => ({
          date: timeLabel(e.occurredAt),
          type: e.typeLabel,
          account: e.account?.name || '',
          person: e.personName || '',
          direction: e.direction,
          amount: moneyNum(e.amount),
          method: e.method || '',
          previous: moneyNum(e.previousBalance),
          updated: moneyNum(e.updatedBalance),
          by: e.user?.name || '',
          note: e.reference || e.notes || ''
        }));
      }
      if (!rows.length && accountEntries) {
        const data = await accountEntries.findMany({
          where: { ...store, ...(dateWhere ? { createdAt: dateWhere } : {}) },
          include: { user: true },
          take: 3000,
          orderBy: { createdAt: 'desc' }
        });
        rows = data.map((e: any) => {
          const typeName = String(e.type || '');
          const isOut = /PAY|EXPENSE|WITHDRAW|OUT/i.test(typeName);
          return {
            date: timeLabel(e.createdAt),
            type: typeName,
            account: e.method || 'Account',
            person: '',
            direction: isOut ? 'OUT' : 'IN',
            amount: moneyNum(e.amount),
            method: e.method || '',
            previous: 0,
            updated: moneyNum(e.amount),
            by: e.user?.name || '',
            note: e.reference || e.notes || ''
          };
        }).filter((r: { method: string }) => {
          if (type === 'cash-management') return /CASH/i.test(String(r.method));
          if (type === 'bank-transactions') return /BANK|CARD|TRANSFER/i.test(String(r.method));
          return true;
        });
      }
      if (!ledger && !accountEntries) {
        rows = [];
      }
      const inn = rows.filter((r) => String(r.direction) === 'IN');
      const out = rows.filter((r) => String(r.direction) === 'OUT');
      const title =
        type === 'cash-management' ? 'Cash Management Report'
          : type === 'bank-transactions' ? 'Bank Transaction Report'
            : type === 'money-ledger' ? 'Account Transaction Report'
              : 'Money Report';
      return payload(type, title, periodLabel, [
        { key: 'date', label: 'Date', kind: 'date' },
        { key: 'type', label: 'Type' },
        { key: 'account', label: 'Account' },
        { key: 'person', label: 'Source / recipient' },
        { key: 'direction', label: 'In / Out' },
        { key: 'amount', label: 'Amount', kind: 'money' },
        { key: 'method', label: 'Method' },
        { key: 'previous', label: 'Previous', kind: 'money' },
        { key: 'updated', label: 'Updated', kind: 'money' },
        { key: 'by', label: 'By' }
      ], rows, [
        { label: 'Records', value: rows.length },
        { label: 'Money in', value: sumKey(inn, 'amount') },
        { label: 'Money out', value: sumKey(out, 'amount') },
        { label: 'Net', value: moneyNum(sumKey(inn, 'amount') - sumKey(out, 'amount')) }
      ], 'amount');
    }
    case 'unpaid-suppliers':
    case 'supplier-dues':
    case 'pending-supplier-payments':
    case 'overdue-supplier-dues': {
      const data = await prisma.supplier.findMany({
        where: {
          ...store,
          unpaidAmount: { gt: 0 },
          ...(type === 'overdue-supplier-dues' ? { dueDate: { lt: new Date() } } : {})
        },
        orderBy: { name: 'asc' }
      });
      const rows = data.map((s) => ({
        supplier: s.name,
        paid: moneyNum(s.paidAmount),
        due: moneyNum(s.unpaidAmount),
        dueDate: dateLabel(s.dueDate),
        overdue: s.dueDate && s.dueDate < new Date() && s.unpaidAmount > 0 ? 'Overdue' : 'Open'
      }));
      return payload(type, 'Unpaid Supplier Report', periodLabel, [
        { key: 'supplier', label: 'Supplier' },
        { key: 'paid', label: 'Paid', kind: 'money' },
        { key: 'due', label: 'Current due', kind: 'money' },
        { key: 'dueDate', label: 'Due date', kind: 'date' },
        { key: 'overdue', label: 'Status' }
      ], rows, [
        { label: 'Suppliers', value: rows.length },
        { label: 'Total paid', value: sumKey(rows, 'paid') },
        { label: 'Total due', value: sumKey(rows, 'due') },
        { label: 'Overdue amount', value: sumKey(rows.filter((r) => r.overdue === 'Overdue'), 'due') }
      ], 'due');
    }
    case 'supplier-purchases':
    case 'supplier-purchase-history':
    case 'monthly-supplier-expenses':
    case 'yearly-supplier-expenses': {
      const ledger = prismaDelegate('supplierLedgerEntry');
      if (!ledger) {
        const suppliers = await prisma.supplier.findMany({ where: store, orderBy: { name: 'asc' }, take: 500 });
        const rows = suppliers.map((s) => ({
          date: dateLabel(s.updatedAt),
          supplier: s.name,
          amount: moneyNum(Number(s.paidAmount || 0) + Number(s.unpaidAmount || 0)),
          invoice: '',
          product: '',
          qty: '',
          by: ''
        }));
        return payload(type, 'Supplier Purchase Report', periodLabel, [
          { key: 'date', label: 'Date', kind: 'date' },
          { key: 'supplier', label: 'Supplier' },
          { key: 'amount', label: 'Purchase', kind: 'money' },
          { key: 'invoice', label: 'Invoice' },
          { key: 'product', label: 'Product' },
          { key: 'qty', label: 'Qty', kind: 'num' },
          { key: 'by', label: 'By' }
        ], rows, [
          { label: 'Total purchases', value: sumKey(rows, 'amount') },
          { label: 'Records', value: rows.length }
        ], 'amount');
      }
      const data = await ledger.findMany({
        where: { type: 'PURCHASE', ...store, ...(dateWhere ? { occurredAt: dateWhere } : {}) },
        include: { supplier: true, user: true },
        take: 3000,
        orderBy: { occurredAt: 'desc' }
      });
      const rows = data.map((e: any) => ({
        date: dateLabel(e.occurredAt),
        supplier: e.supplier?.name || '',
        amount: moneyNum(e.amount),
        invoice: e.invoiceNumber || '',
        product: e.productName || '',
        qty: e.quantity ?? '',
        by: e.user?.name || ''
      }));
      return payload(type, 'Supplier Purchase Report', periodLabel, [
        { key: 'date', label: 'Date', kind: 'date' },
        { key: 'supplier', label: 'Supplier' },
        { key: 'amount', label: 'Purchase', kind: 'money' },
        { key: 'invoice', label: 'Invoice' },
        { key: 'product', label: 'Product' },
        { key: 'qty', label: 'Qty', kind: 'num' },
        { key: 'by', label: 'By' }
      ], rows, [
        { label: 'Total purchases', value: sumKey(rows, 'amount') },
        { label: 'Records', value: rows.length }
      ], 'amount');
    }
    case 'supplier-payments':
    case 'supplier-payment-history': {
      const ledger = prismaDelegate('supplierLedgerEntry');
      if (!ledger) {
        return payload(type, 'Supplier Payment History Report', periodLabel, [
          { key: 'date', label: 'Date', kind: 'date' },
          { key: 'supplier', label: 'Supplier' },
          { key: 'amount', label: 'Payment', kind: 'money' },
          { key: 'method', label: 'Method' },
          { key: 'previous', label: 'Previous due', kind: 'money' },
          { key: 'remaining', label: 'Remaining due', kind: 'money' },
          { key: 'by', label: 'Paid by' }
        ], [], [
          { label: 'Total paid', value: 0 },
          { label: 'Payments', value: 0 }
        ], 'amount');
      }
      const data = await ledger.findMany({
        where: { type: 'PAYMENT', ...store, ...(dateWhere ? { occurredAt: dateWhere } : {}) },
        include: { supplier: true, user: true },
        take: 3000,
        orderBy: { occurredAt: 'desc' }
      });
      const rows = data.map((e: any) => ({
        date: timeLabel(e.occurredAt),
        supplier: e.supplier?.name || '',
        amount: moneyNum(e.amount),
        method: e.method || '',
        reference: e.reference || '',
        previous: moneyNum(e.previousBalance),
        remaining: moneyNum(e.updatedBalance),
        by: e.user?.name || ''
      }));
      return payload(type, 'Supplier Payment History Report', periodLabel, [
        { key: 'date', label: 'Date', kind: 'date' },
        { key: 'supplier', label: 'Supplier' },
        { key: 'amount', label: 'Payment', kind: 'money' },
        { key: 'method', label: 'Method' },
        { key: 'previous', label: 'Previous due', kind: 'money' },
        { key: 'remaining', label: 'Remaining due', kind: 'money' },
        { key: 'by', label: 'Paid by' }
      ], rows, [
        { label: 'Total paid', value: sumKey(rows, 'amount') },
        { label: 'Payments', value: rows.length }
      ], 'amount');
    }
    case 'payroll':
    case 'pending-dues': {
      const data = await prisma.salaryRecord.findMany({
        where: {
          ...store,
          ...(type === 'pending-dues' ? { paymentStatus: { in: ['UNPAID', 'PARTIAL'] } } : {})
        },
        include: { user: true },
        take: 500,
        orderBy: { periodStart: 'desc' }
      });
      const rows = data.map((r) => ({
        employee: r.user?.name || '',
        start: dateLabel(r.periodStart),
        end: dateLabel(r.periodEnd),
        calculated: moneyNum(r.calculatedSalary),
        paid: moneyNum(r.paidAmount),
        due: moneyNum(r.dueAmount),
        status: r.paymentStatus
      }));
      return payload(type, type === 'pending-dues' ? 'Total Pending Dues Report' : 'Payroll Report', periodLabel, [
        { key: 'employee', label: 'Employee' },
        { key: 'start', label: 'From', kind: 'date' },
        { key: 'end', label: 'To', kind: 'date' },
        { key: 'calculated', label: 'Calculated', kind: 'money' },
        { key: 'paid', label: 'Paid', kind: 'money' },
        { key: 'due', label: 'Due', kind: 'money' },
        { key: 'status', label: 'Status' }
      ], rows, [
        { label: 'Calculated', value: sumKey(rows, 'calculated') },
        { label: 'Paid', value: sumKey(rows, 'paid') },
        { label: 'Due', value: sumKey(rows, 'due') },
        { label: 'Records', value: rows.length }
      ], 'due');
    }
    case 'documents':
    case 'document-activity': {
      const data = await prisma.document.findMany({
        where: { ...store, ...(dateWhere ? { createdAt: dateWhere } : {}) },
        include: { uploadedBy: true },
        take: 1000,
        orderBy: { createdAt: 'desc' }
      });
      const rows = data.map((d) => ({
        title: d.title,
        directory: d.directory,
        period: `${d.periodMonth || ''}/${d.periodYear || ''}`,
        by: d.uploadedBy?.name || '',
        date: dateLabel(d.createdAt)
      }));
      return payload(type, type === 'document-activity' ? 'Document Activity Report' : 'Documents Report', periodLabel, [
        { key: 'title', label: 'Title' },
        { key: 'directory', label: 'Folder' },
        { key: 'period', label: 'Period' },
        { key: 'by', label: 'Uploaded by' },
        { key: 'date', label: 'Date', kind: 'date' }
      ], rows, [{ label: 'Documents', value: rows.length }], undefined);
    }
    case 'low-stock':
    case 'inventory':
    case 'stock': {
      const data = await prisma.product.findMany({
        where: store,
        include: { supplier: true },
        take: 5000,
        orderBy: { name: 'asc' }
      });
      const filtered = type === 'low-stock' ? data.filter((p) => p.stockQuantity <= p.minimumStock) : data;
      const rows = filtered.map((p) => ({
        product: p.name,
        barcode: p.barcode,
        category: p.category,
        supplier: p.supplier?.name || '',
        size: p.size || '',
        stock: p.stockQuantity,
        min: p.minimumStock,
        cost: moneyNum(p.purchasePrice),
        price: moneyNum(p.sellingPrice),
        value: moneyNum(p.stockQuantity * p.purchasePrice),
        status: p.stockQuantity <= 0 ? 'Out of stock' : p.stockQuantity <= p.minimumStock ? 'Low' : 'OK',
        active: p.isActive ? 'Active' : 'Inactive',
        updated: dateLabel(p.lastStockUpdatedAt || p.updatedAt)
      }));
      return payload(type, type === 'low-stock' ? 'Low Stock Report' : type === 'stock' ? 'Stock Report' : 'Live Inventory Report', periodLabel, [
        { key: 'product', label: 'Product' },
        { key: 'barcode', label: 'Barcode' },
        { key: 'category', label: 'Category' },
        { key: 'supplier', label: 'Supplier' },
        { key: 'size', label: 'Size' },
        { key: 'stock', label: 'Stock', kind: 'num' },
        { key: 'status', label: 'Status' },
        { key: 'cost', label: 'Cost', kind: 'money' },
        { key: 'price', label: 'Sell', kind: 'money' },
        { key: 'value', label: 'Stock value', kind: 'money' },
        { key: 'updated', label: 'Last updated', kind: 'date' },
        { key: 'active', label: 'Active' }
      ], rows, [
        { label: 'Total products', value: rows.length },
        { label: 'Total stock', value: rows.reduce((s, r) => s + Number(r.stock || 0), 0) },
        { label: 'Low stock', value: rows.filter((r) => r.status === 'Low').length },
        { label: 'Out of stock', value: rows.filter((r) => r.status === 'Out of stock').length },
        { label: 'Stock value', value: sumKey(rows, 'value') }
      ], 'value');
    }
    case 'attendance': {
      const data = await prisma.attendance.findMany({
        where: { ...store, ...(dateWhere ? { date: dateWhere } : {}) },
        include: { user: true },
        take: 2000,
        orderBy: { date: 'desc' }
      });
      const rows = data.map((a) => {
        const inT = a.clockIn;
        const late = inT ? inT.getHours() > 9 || (inT.getHours() === 9 && inT.getMinutes() > 15) : false;
        return {
          employee: a.user?.name || '',
          date: dateLabel(a.date),
          clockIn: a.clockIn ? a.clockIn.toLocaleTimeString('en-GB') : '',
          clockOut: a.clockOut ? a.clockOut.toLocaleTimeString('en-GB') : '',
          hours: Number(((a.workMinutes || 0) / 60).toFixed(2)),
          status: !a.clockIn ? 'Absent' : late ? 'Late' : 'On time'
        };
      });
      return payload(type, 'Attendance Report', periodLabel, [
        { key: 'employee', label: 'Employee' },
        { key: 'date', label: 'Date', kind: 'date' },
        { key: 'clockIn', label: 'Clock in' },
        { key: 'clockOut', label: 'Clock out' },
        { key: 'hours', label: 'Hours', kind: 'num' },
        { key: 'status', label: 'Status' }
      ], rows, [
        { label: 'Records', value: rows.length },
        { label: 'On time', value: rows.filter((r) => r.status === 'On time').length },
        { label: 'Late', value: rows.filter((r) => r.status === 'Late').length }
      ], undefined);
    }
    case 'product-sales': {
      const sales = await prisma.sale.findMany({
        where: { status: { not: 'VOID' }, ...store, ...(dateWhere ? { saleDate: dateWhere } : {}) },
        include: { items: { include: { product: true } } },
        take: 2000
      });
      const map = new Map<string, { product: string; qty: number; amount: number }>();
      for (const s of sales) {
        for (const item of s.items || []) {
          const name = item.product?.name || item.name || 'Item';
          const cur = map.get(name) || { product: name, qty: 0, amount: 0 };
          cur.qty += Number(item.quantity || 0);
          cur.amount += moneyNum(item.lineTotal ?? Number(item.quantity) * Number(item.sellingPrice || 0));
          map.set(name, cur);
        }
      }
      const rows = [...map.values()].sort((a, b) => b.amount - a.amount);
      return payload(type, 'Product Sales Report', periodLabel, [
        { key: 'product', label: 'Product' },
        { key: 'qty', label: 'Quantity', kind: 'num' },
        { key: 'amount', label: 'Sales', kind: 'money' }
      ], rows, [
        { label: 'Products', value: rows.length },
        { label: 'Units sold', value: rows.reduce((s, r) => s + Number(r.qty || 0), 0) },
        { label: 'Total sales', value: sumKey(rows, 'amount') }
      ], 'amount');
    }
    case 'employee-sales': {
      const data = await prisma.sale.findMany({
        where: { status: { not: 'VOID' }, ...store, ...(dateWhere ? { saleDate: dateWhere } : {}) },
        include: { staff: true },
        take: 3000
      });
      const map = new Map<string, { employee: string; orders: number; amount: number }>();
      for (const s of data) {
        const name = s.staff?.name || 'Unassigned';
        const cur = map.get(name) || { employee: name, orders: 0, amount: 0 };
        cur.orders += 1;
        cur.amount += moneyNum(s.total);
        map.set(name, cur);
      }
      const rows = [...map.values()].sort((a, b) => b.amount - a.amount);
      return payload(type, 'Employee Sales Report', periodLabel, [
        { key: 'employee', label: 'Employee' },
        { key: 'orders', label: 'Orders', kind: 'num' },
        { key: 'amount', label: 'Sales', kind: 'money' }
      ], rows, [
        { label: 'Staff', value: rows.length },
        { label: 'Orders', value: rows.reduce((s, r) => s + Number(r.orders || 0), 0) },
        { label: 'Total sales', value: sumKey(rows, 'amount') }
      ], 'amount');
    }
    case 'profit-loss': {
      const sales = await prisma.sale.findMany({
        where: { status: { not: 'VOID' }, ...store, ...(dateWhere ? { saleDate: dateWhere } : {}) },
        take: 5000
      });
      const expenses = await prisma.expense.findMany({
        where: { ...store, ...(dateWhere ? { expenseDate: dateWhere } : {}) },
        take: 2000
      });
      const revenue = moneyNum(sales.reduce((s, r) => s + r.total, 0));
      const expenseTotal = moneyNum(expenses.reduce((s, r) => s + r.amount, 0));
      const rows = [
        { line: 'Sales income', amount: revenue },
        { line: 'Expenses', amount: expenseTotal },
        { line: 'Profit / loss', amount: moneyNum(revenue - expenseTotal) }
      ];
      return payload(type, 'Profit & Loss Report', periodLabel, [
        { key: 'line', label: 'Line' },
        { key: 'amount', label: 'Amount', kind: 'money' }
      ], rows, [
        { label: 'Sales', value: revenue },
        { label: 'Expenses', value: expenseTotal },
        { label: 'Profit / loss', value: moneyNum(revenue - expenseTotal) }
      ], 'amount');
    }
    default: {
      return buildTypedReport('sales', storeId, range);
    }
  }
}

export async function getOpsReportData(input: {
  type: string;
  storeId?: string;
  period?: string | null;
  from?: string | null;
  to?: string | null;
  q?: string | null;
  filters?: Record<string, string | null | undefined>;
}) {
  const range = resolvePeriod(input.period, input.from, input.to);
  try {
    const data = await buildTypedReport(input.type || 'sales', input.storeId, range);
    const q = String(input.q || '').trim().toLowerCase();
    const filters = input.filters || {};
    const rows = data.rows.filter((row) => {
      if (q && !Object.values(row).some((v) => String(v || '').toLowerCase().includes(q))) return false;
      for (const [key, value] of Object.entries(filters)) {
        if (!value) continue;
        if (String(row[key] ?? '') !== value) return false;
      }
      return true;
    });
    const periodLabel =
      range.from && range.to ? formatDateRangeLabel(range.from, range.to) : data.periodLabel;
    return { ...data, rows, periodLabel, totalAmount: data.totalAmount };
  } catch (error) {
    console.error('[reports]', {
      type: input.type,
      period: input.period,
      from: input.from,
      to: input.to,
      storeId: input.storeId,
      error
    });
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (/ByteString|WinAnsi|WinAnsiEncoding|pdfkit|PDFDocument/i.test(message)) {
      throw new AppError('REPORT_ERROR', 'Unable to load this report. Please try again.', 500);
    }
    throw error;
  }
}

export async function buildOpsReportFile(input: {
  type: string;
  format: 'pdf' | 'excel';
  storeId?: string;
  period?: string | null;
  from?: string | null;
  to?: string | null;
  generatedBy?: string;
  q?: string | null;
  filters?: Record<string, string | null | undefined>;
}) {
  const data = await getOpsReportData(input);
  const filename = stamp(input.type, data.periodLabel.replace(/\s+/g, '-'), input.format === 'excel' ? 'xlsx' : 'pdf');
  if (input.format === 'excel') {
    return buildStructuredExcel({
      data,
      generatedBy: input.generatedBy,
      filters: input.filters,
      q: input.q,
      filename
    });
  }
  return buildStructuredPdf({
    data,
    generatedBy: input.generatedBy,
    filters: input.filters,
    q: input.q,
    filename
  });
}

async function unusedLegacyRowsForType(type: string, storeId?: string, range?: { from?: Date; to?: Date }) {
  const from = range?.from;
  const to = range?.to;
  const dateWhere = from ? { gte: from, ...(to ? { lte: to } : {}) } : undefined;
  switch (type) {
    case 'expenses':
      return (await prisma.expense.findMany({
        where: { ...(storeId ? { storeId } : {}), ...(dateWhere ? { expenseDate: dateWhere } : {}) },
        include: { user: true },
        take: 500
      })).map((e) => [e.expenseDate.toLocaleDateString('en-GB'), e.category, e.amount, e.paymentStatus, e.reference || '', e.user?.name || '']);
    case 'loans':
      return (await prisma.loan.findMany({
        where: storeId ? { storeId } : {},
        take: 200
      })).map((l) => [l.lender, l.amount, l.paidAmount, l.remaining, l.dueDate ? l.dueDate.toLocaleDateString('en-GB') : '']);
    case 'unpaid-sales':
      return (await prisma.sale.findMany({
        where: { paymentStatus: 'UNPAID', status: { not: 'VOID' }, ...(storeId ? { storeId } : {}), ...(dateWhere ? { saleDate: dateWhere } : {}) },
        include: { staff: true, customer: true },
        take: 500
      })).map((s) => [s.invoiceNumber, s.customer?.name || '', s.staff?.name || '', s.total, s.saleDate.toLocaleDateString('en-GB')]);
    case 'money-ledger':
    case 'money':
      return (await prisma.moneyLedgerEntry.findMany({
        where: {
          ...(storeId ? { storeId } : {}),
          ...(dateWhere ? { occurredAt: dateWhere } : {})
        },
        include: { user: true, account: true },
        take: 2000
      })).map((e) => [
        e.occurredAt.toLocaleString('en-GB'),
        e.typeLabel,
        e.account?.name || '',
        e.personName || '',
        e.direction,
        e.amount,
        e.method || '',
        e.previousBalance,
        e.updatedBalance,
        e.user?.name || '',
        e.reference || e.notes || ''
      ]);
    case 'unpaid-suppliers':
    case 'supplier-dues':
    case 'pending-supplier-payments':
    case 'overdue-supplier-dues':
      return (await prisma.supplier.findMany({
        where: {
          ...(storeId ? { storeId } : {}),
          unpaidAmount: { gt: 0 },
          ...(type === 'overdue-supplier-dues' ? { dueDate: { lt: new Date() } } : {})
        }
      })).map((s) => [s.name, s.paidAmount, s.unpaidAmount, s.dueDate ? s.dueDate.toLocaleDateString('en-GB') : '', type]);
    case 'supplier-purchases':
    case 'supplier-purchase-history':
    case 'monthly-supplier-expenses':
    case 'yearly-supplier-expenses':
      return (await prisma.supplierLedgerEntry.findMany({
        where: {
          type: 'PURCHASE',
          ...(storeId ? { storeId } : {}),
          ...(dateWhere ? { occurredAt: dateWhere } : {})
        },
        include: { supplier: true, user: true },
        take: 2000
      })).map((e) => [
        e.occurredAt.toLocaleDateString('en-GB'),
        e.supplier?.name || '',
        e.amount,
        e.invoiceNumber || '',
        e.productName || '',
        e.user?.name || '',
        e.notes || ''
      ]);
    case 'supplier-payments':
    case 'supplier-payment-history':
      return (await prisma.supplierLedgerEntry.findMany({
        where: {
          type: 'PAYMENT',
          ...(storeId ? { storeId } : {}),
          ...(dateWhere ? { occurredAt: dateWhere } : {})
        },
        include: { supplier: true, user: true },
        take: 2000
      })).map((e) => [
        e.occurredAt.toLocaleString('en-GB'),
        e.supplier?.name || '',
        e.amount,
        e.method || '',
        e.reference || '',
        e.previousBalance,
        e.updatedBalance,
        e.user?.name || '',
        e.notes || ''
      ]);
    case 'payroll':
    case 'pending-dues':
      return (await prisma.salaryRecord.findMany({
        where: { ...(storeId ? { storeId } : {}), ...(type === 'pending-dues' ? { paymentStatus: { in: ['UNPAID', 'PARTIAL'] } } : {}) },
        include: { user: true },
        take: 300
      })).map((r) => [r.user?.name || '', r.calculatedSalary, r.paidAmount, r.dueAmount, r.paymentStatus]);
    case 'documents':
      return (await prisma.document.findMany({
        where: storeId ? { storeId } : {},
        include: { uploadedBy: true },
        take: 500
      })).map((d) => [d.title, d.directory, `${d.periodMonth || ''}/${d.periodYear || ''}`, d.uploadedBy?.name || '', d.createdAt.toLocaleDateString('en-GB')]);
    case 'low-stock':
    case 'inventory':
    case 'stock':
      return (await prisma.product.findMany({
        where: { ...(storeId ? { storeId } : {}) },
        include: { supplier: true },
        take: 500
      })).map((p) => [p.name, p.stockQuantity, p.supplier?.name || '', p.lastStockUpdatedAt?.toLocaleDateString('en-GB') || '']);
    case 'attendance':
      return (await prisma.attendance.findMany({
        where: { ...(storeId ? { storeId } : {}), ...(dateWhere ? { date: dateWhere } : {}) },
        include: { user: true },
        take: 500
      })).map((a) => [a.user?.name || '', a.clockIn?.toLocaleString('en-GB') || '', a.clockOut?.toLocaleString('en-GB') || '', a.openingCash ?? '']);
    case 'income':
    case 'money':
    case 'sales':
    case 'sales-history':
    default:
      return (await prisma.sale.findMany({
        where: { status: { not: 'VOID' }, ...(storeId ? { storeId } : {}), ...(dateWhere ? { saleDate: dateWhere } : {}) },
        include: { staff: true, customer: true },
        take: 500
      })).map((s) => [s.invoiceNumber, s.staff?.name || '', s.customer?.name || '', s.total, s.paymentStatus, s.channel, s.saleDate.toLocaleString('en-GB')]);
  }
}

function _discardLegacyOpsReport() {
  return unusedLegacyRowsForType('sales', undefined, undefined);
}
void _discardLegacyOpsReport;
