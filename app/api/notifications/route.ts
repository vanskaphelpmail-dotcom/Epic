import { errorResponse, ok, AppError } from '@/lib/errors';
import { prisma, prismaDelegate } from '@/lib/prisma';
import { requireAnyPermission } from '@/services/auth.service';

function targetForType(type: string) {
  const t = String(type || '').toUpperCase();
  if (/STOCK|PRODUCT|INVENTORY/.test(t)) return 'Inventory';
  if (/SALE|INVOICE|UNPAID/.test(t)) return 'Sales';
  if (/SUPPLIER/.test(t)) return 'Suppliers';
  if (/EXPENSE|RENT|BILL/.test(t)) return 'Expenses';
  if (/PAYROLL|SALARY/.test(t)) return 'Payroll';
  if (/CLOCK|ATTEND|LATE|ABSENT/.test(t)) return 'Attendance';
  if (/REQUEST|DOCUMENT/.test(t)) return 'Requests';
  if (/CASH|BANK|ACCOUNT/.test(t)) return 'Accounts';
  return 'Overview';
}

export async function GET() {
  try {
    const user = await requireAnyPermission('DASHBOARD_VIEW', 'SALES_VIEW', 'PRODUCT_VIEW');
    const stored = prismaDelegate('notification');
    let rows: any[] = [];
    if (stored) {
      rows = await stored.findMany({
        where: {
          OR: [{ userId: user.id }, { userId: null, storeId: user.storeId || undefined }]
        },
        orderBy: { createdAt: 'desc' },
        take: 80
      });
    }

    const attention: any[] = [];
    if (user.storeId) {
      const [lowStock, unpaid, pendingPay, dueExp] = await Promise.all([
        prisma.product.count({
          where: { storeId: user.storeId, isActive: true, stockQuantity: { lte: 5 } }
        }).catch(() => 0),
        prisma.sale.count({
          where: { storeId: user.storeId, paymentStatus: { in: ['UNPAID', 'PARTIAL'] }, status: { not: 'VOID' } }
        }).catch(() => 0),
        prisma.salaryRecord.count({
          where: { storeId: user.storeId, paymentStatus: { in: ['UNPAID', 'PARTIAL'] } }
        }).catch(() => 0),
        prisma.expense.count({
          where: { storeId: user.storeId, paymentStatus: { not: 'PAID' }, dueDate: { lte: new Date() } }
        }).catch(() => 0)
      ]);
      if (lowStock) attention.push({ id: 'attn-low', title: `${lowStock} low-stock products`, message: 'Reorder before stock runs out.', type: 'INVENTORY', isRead: false, createdAt: new Date(), target: 'Inventory' });
      if (unpaid) attention.push({ id: 'attn-unpaid', title: `${unpaid} unpaid invoices`, message: 'Customer dues waiting to be collected.', type: 'SALES', isRead: false, createdAt: new Date(), target: 'Unpaid / Due' });
      if (pendingPay) attention.push({ id: 'attn-pay', title: `${pendingPay} payroll records due`, message: 'Salary payments outstanding.', type: 'PAYROLL', isRead: false, createdAt: new Date(), target: 'Payroll' });
      if (dueExp) attention.push({ id: 'attn-exp', title: `${dueExp} expenses due`, message: 'Bills at or past due date.', type: 'EXPENSES', isRead: false, createdAt: new Date(), target: 'Expenses' });
    }

    const mapped = rows.map((n) => ({
      ...n,
      target: targetForType(n.type)
    }));
    const unread = mapped.filter((n) => !n.isRead).length + attention.length;
    return ok({ items: [...attention, ...mapped], unread });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireAnyPermission('DASHBOARD_VIEW', 'SALES_VIEW', 'PRODUCT_VIEW');
    const body = await req.json().catch(() => ({}));
    const stored = prismaDelegate('notification');
    if (!stored) throw new AppError('NOT_FOUND', 'Notifications are not available', 404);
    if (body.all) {
      await stored.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
    }
    return ok({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
