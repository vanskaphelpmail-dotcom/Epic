import { errorResponse, ok } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { requireAnyPermission } from '@/services/auth.service';

export async function GET(req: Request) {
  try {
    const user = await requireAnyPermission('DASHBOARD_VIEW', 'PRODUCT_VIEW', 'SALES_VIEW');
    const q = new URL(req.url).searchParams.get('q')?.trim() || '';
    if (q.length < 2) return ok({ groups: [] });
    const store = user.storeId ? { storeId: user.storeId } : {};
    const contains = { contains: q, mode: 'insensitive' as const };

    const [products, sales, suppliers, expenses, docs, staff] = await Promise.all([
      prisma.product.findMany({
        where: { ...store, OR: [{ name: contains }, { barcode: contains }, { sku: contains }, { brand: contains }] },
        take: 8,
        select: { id: true, name: true, barcode: true }
      }).catch(() => []),
      prisma.sale.findMany({
        where: { ...store, OR: [{ invoiceNumber: contains }] },
        take: 8,
        select: { id: true, invoiceNumber: true, total: true }
      }).catch(() => []),
      prisma.supplier.findMany({
        where: { ...store, OR: [{ name: contains }, { phone: contains }, { email: contains }] },
        take: 8,
        select: { id: true, name: true, phone: true }
      }).catch(() => []),
      prisma.expense.findMany({
        where: { ...store, OR: [{ reference: contains }, { description: contains }] },
        take: 8,
        select: { id: true, category: true, amount: true }
      }).catch(() => []),
      prisma.document.findMany({
        where: { ...store, OR: [{ title: contains }] },
        take: 8,
        select: { id: true, title: true, directory: true }
      }).catch(() => []),
      prisma.user.findMany({
        where: {
          ...(user.storeId ? { storeId: user.storeId } : {}),
          OR: [{ name: contains }, { employeeId: contains }, { email: contains }]
        },
        take: 8,
        select: { id: true, name: true, employeeId: true }
      }).catch(() => [])
    ]);

    const groups = [
      { key: 'Inventory', items: products.map((p) => ({ id: p.id, label: p.name, hint: p.barcode, page: 'Inventory' })) },
      { key: 'Invoices', items: sales.map((s) => ({ id: s.id, label: s.invoiceNumber, hint: String(s.total), page: 'Sales' })) },
      { key: 'Suppliers', items: suppliers.map((s) => ({ id: s.id, label: s.name, hint: s.phone || '', page: 'Suppliers' })) },
      { key: 'Expenses', items: expenses.map((e) => ({ id: e.id, label: e.category, hint: String(e.amount), page: 'Expenses' })) },
      { key: 'Documents', items: docs.map((d) => ({ id: d.id, label: d.title, hint: d.directory || '', page: 'Documents' })) },
      { key: 'Employees', items: staff.map((u) => ({ id: u.id, label: u.name, hint: u.employeeId || '', page: 'Team & Roles' })) }
    ].filter((g) => g.items.length);

    return ok({ groups });
  } catch (error) {
    return errorResponse(error);
  }
}
