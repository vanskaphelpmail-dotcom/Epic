import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { endOfDay, startOfDay } from '@/lib/date-range';

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function startOfLastMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1, 0, 0, 0, 0);
}

function startOfWeekMonday(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay();
  x.setDate(x.getDate() - (day === 0 ? 6 : day - 1));
  return x;
}

function formatTime(d?: Date | null) {
  if (!d) return null;
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

type SessionUser = {
  id: string;
  role: string;
  storeId?: string | null;
  permissions: string[];
};

export async function getDashboardSummary(user: SessionUser) {
  const storeId = user.storeId || undefined;
  const now = new Date();
  const day = startOfDay(now);
  const dayEnd = endOfDay(now);
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = startOfLastMonth(now);
  const lastMonthEnd = new Date(thisMonthStart.getTime() - 1);
  const weekStart = startOfWeekMonday(now);
  const canSeeCost = user.role === 'ADMIN' || user.permissions.includes('COST_VIEW');
  const canSeeSales =
    user.role === 'ADMIN' ||
    user.permissions.includes('SALES_VIEW') ||
    user.permissions.includes('SALES_REPORT_VIEW') ||
    user.permissions.includes('DASHBOARD_VIEW');
  const canSeePayroll = user.role === 'ADMIN' || user.permissions.includes('SALARY_VIEW');
  const canSeeAttendance =
    user.role === 'ADMIN' ||
    user.permissions.includes('ATTENDANCE_VIEW') ||
    user.permissions.includes('ATTENDANCE_CLOCK_IN');

  const storeFilter = storeId ? Prisma.sql`AND "Product"."storeId" = ${storeId}` : Prisma.empty;
  const saleStore = storeId ? Prisma.sql`AND "Sale"."storeId" = ${storeId}` : Prisma.empty;

  const emptySales = [
    {
      today_sales: 0,
      today_count: 0,
      last_month_sales: 0,
      last_month_count: 0,
      this_month_sales: 0
    }
  ];

  const salesStats = canSeeSales
    ? await prisma.$queryRaw<
        Array<{
          today_sales: number;
          today_count: number;
          last_month_sales: number;
          last_month_count: number;
          this_month_sales: number;
        }>
      >`
        SELECT
          COALESCE(SUM(total) FILTER (WHERE "saleDate" >= ${day} AND "saleDate" <= ${dayEnd}), 0)::double precision AS today_sales,
          COUNT(*) FILTER (WHERE "saleDate" >= ${day} AND "saleDate" <= ${dayEnd})::int AS today_count,
          COALESCE(SUM(total) FILTER (WHERE "saleDate" >= ${lastMonthStart} AND "saleDate" <= ${lastMonthEnd}), 0)::double precision AS last_month_sales,
          COUNT(*) FILTER (WHERE "saleDate" >= ${lastMonthStart} AND "saleDate" <= ${lastMonthEnd})::int AS last_month_count,
          COALESCE(SUM(total) FILTER (WHERE "saleDate" >= ${thisMonthStart}), 0)::double precision AS this_month_sales
        FROM "Sale"
        WHERE status <> 'VOID'
        ${saleStore}
      `
    : emptySales;

  const stockRows = await prisma.$queryRaw<Array<{ cost_value: number; sell_value: number; low_count: number }>>`
    SELECT
      COALESCE(SUM("stockQuantity" * "purchasePrice"), 0)::double precision AS cost_value,
      COALESCE(SUM("stockQuantity" * "sellingPrice"), 0)::double precision AS sell_value,
      COUNT(*) FILTER (WHERE "stockQuantity" <= "minimumStock")::int AS low_count
    FROM "Product"
    WHERE "isActive" = true
    ${storeFilter}
  `;

  const weekRows = canSeeSales
    ? await prisma.$queryRaw<Array<{ dow: number; total: number }>>`
        SELECT EXTRACT(ISODOW FROM "saleDate")::int AS dow,
               COALESCE(SUM(total), 0)::double precision AS total
        FROM "Sale"
        WHERE status <> 'VOID'
          AND "saleDate" >= ${weekStart}
          ${saleStore}
        GROUP BY 1
      `
    : [];

  const lowStock = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      sku: string;
      stockQuantity: number;
      minimumStock: number;
    }>
  >`
    SELECT id, name, sku, "stockQuantity", "minimumStock"
    FROM "Product"
    WHERE "isActive" = true
      AND "stockQuantity" <= "minimumStock"
    ${storeFilter}
    ORDER BY "stockQuantity" ASC
    LIMIT 8
  `;

  const clockedIn = canSeeAttendance
    ? await prisma.attendance.count({
        where: { clockIn: { not: null }, clockOut: null, ...(storeId ? { storeId } : {}) }
      })
    : 0;

  const pendingSalary = canSeePayroll
    ? await prisma.salaryRecord.aggregate({
        where: {
          paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
          ...(storeId ? { storeId } : {})
        },
        _sum: { dueAmount: true }
      })
    : { _sum: { dueAmount: 0 } };

  const recentOrders = canSeeSales
    ? await prisma.sale.findMany({
        where: storeId ? { storeId } : {},
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
          saleDate: true,
          customer: { select: { name: true } },
          _count: { select: { items: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    : [];

  const todaySalesByStaff = canSeeSales
    ? await prisma.sale.findMany({
        where: {
          status: { not: 'VOID' },
          saleDate: { gte: day, lte: dayEnd },
          ...(storeId ? { storeId } : {})
        },
        select: {
          staffId: true,
          total: true,
          staff: { select: { name: true, employeeId: true } }
        }
      })
    : [];

  const todayAttendance = canSeeAttendance
    ? await prisma.attendance.findMany({
        where: {
          date: { gte: day, lte: dayEnd },
          ...(storeId ? { storeId } : {})
        },
        select: {
          userId: true,
          clockIn: true,
          clockOut: true,
          workMinutes: true,
          user: { select: { name: true, employeeId: true } }
        },
        orderBy: { clockIn: 'asc' }
      })
    : [];

  const stats = salesStats[0] || {
    today_sales: 0,
    today_count: 0,
    last_month_sales: 0,
    last_month_count: 0,
    this_month_sales: 0
  };
  const stockValue = Number((canSeeCost ? stockRows[0]?.cost_value : stockRows[0]?.sell_value) || 0);

  type StaffCard = {
    userId: string;
    name: string;
    employeeId: string | null;
    salesTotal: number;
    invoiceCount: number;
    clockIn: string | null;
    clockOut: string | null;
    clockInAt: string | null;
    clockOutAt: string | null;
    workMinutes: number;
    onShift: boolean;
  };
  const byUser = new Map<string, StaffCard>();

  for (const att of todayAttendance) {
    if (!att.user) continue;
    byUser.set(att.userId, {
      userId: att.userId,
      name: att.user.name,
      employeeId: att.user.employeeId,
      salesTotal: 0,
      invoiceCount: 0,
      clockIn: formatTime(att.clockIn),
      clockOut: formatTime(att.clockOut),
      clockInAt: att.clockIn?.toISOString() || null,
      clockOutAt: att.clockOut?.toISOString() || null,
      workMinutes: att.workMinutes || 0,
      onShift: Boolean(att.clockIn && !att.clockOut)
    });
  }

  for (const sale of todaySalesByStaff) {
    const staffId = sale.staffId;
    const name = sale.staff?.name || 'Unknown staff';
    const existing = byUser.get(staffId);
    if (existing) {
      existing.salesTotal += sale.total || 0;
      existing.invoiceCount += 1;
    } else {
      byUser.set(staffId, {
        userId: staffId,
        name,
        employeeId: sale.staff?.employeeId || null,
        salesTotal: sale.total || 0,
        invoiceCount: 1,
        clockIn: null,
        clockOut: null,
        clockInAt: null,
        clockOutAt: null,
        workMinutes: 0,
        onShift: false
      });
    }
  }

  const staffDayCards = Array.from(byUser.values())
    .map((c) => ({ ...c, salesTotal: Math.round(c.salesTotal * 100) / 100 }))
    .sort((a, b) => b.salesTotal - a.salesTotal || a.name.localeCompare(b.name));

  const weeklyBuckets = [0, 0, 0, 0, 0, 0, 0];
  for (const row of weekRows) {
    const idx = Math.min(6, Math.max(0, Number(row.dow) - 1));
    weeklyBuckets[idx] += Number(row.total || 0);
  }
  const weeklySales = weeklyBuckets.map((total, i) => ({
    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
    total: Math.round(total * 100) / 100
  }));

  const lowCount = Number(stockRows[0]?.low_count || lowStock.length);

  const [unpaidSaleCount, pendingManualCount, pendingDocCount, unreadNotifications] = await Promise.all([
    prisma.sale.count({
      where: { paymentStatus: 'UNPAID', status: { not: 'VOID' }, ...(storeId ? { storeId } : {}) }
    }),
    prisma.product.count({
      where: { isManualEntry: true, reviewStatus: 'PENDING', ...(storeId ? { storeId } : {}) }
    }),
    prisma.document.count({
      where: { status: 'PENDING', ...(storeId ? { storeId } : {}) }
    }),
    prisma.notification.findMany({
      where: {
        isRead: false,
        OR: [{ userId: user.id }, { userId: null, ...(storeId ? { storeId } : {}) }]
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, title: true, message: true, type: true, createdAt: true }
    })
  ]);

  let pendingRequestCount = 0;
  let needInfoRequestCount = 0;
  let readyRequestCount = 0;
  let overdueRequestCount = 0;
  try {
    const now = new Date();
    const reqs = await prisma.employeeDocumentRequest.findMany({
      where: storeId ? { storeId } : {},
      select: { status: true, requiredDate: true }
    });
    pendingRequestCount = reqs.filter((r) => ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(r.status)).length;
    needInfoRequestCount = reqs.filter((r) => r.status === 'NEED_INFORMATION').length;
    readyRequestCount = reqs.filter((r) => r.status === 'READY').length;
    overdueRequestCount = reqs.filter(
      (r) =>
        r.requiredDate &&
        r.requiredDate < now &&
        !['READY', 'COMPLETED', 'REJECTED', 'CANCELLED'].includes(r.status)
    ).length;
  } catch {
    /* requests table may not exist yet */
  }

  const clockedOutToday = todayAttendance.filter((a) => a.clockIn && a.clockOut).length;
  const onTimeToday = todayAttendance.filter((a) => a.clockIn).length;

  let trendingProducts: Array<{ id: string; name: string; qty: number; revenue: number }> = [];
  if (canSeeSales) {
    try {
      trendingProducts = await prisma.$queryRaw`
        SELECT p.id, p.name,
               COALESCE(SUM(si.quantity), 0)::int AS qty,
               COALESCE(SUM(si."lineTotal"), 0)::double precision AS revenue
        FROM "SaleItem" si
        INNER JOIN "Sale" s ON s.id = si."saleId"
        INNER JOIN "Product" p ON p.id = si."productId"
        WHERE s.status <> 'VOID'
          AND s."saleDate" >= ${weekStart}
          ${storeId ? Prisma.sql`AND s."storeId" = ${storeId}` : Prisma.empty}
        GROUP BY p.id, p.name
        ORDER BY qty DESC, revenue DESC
        LIMIT 10
      `;
    } catch {
      trendingProducts = [];
    }
  }

  const hour = now.getHours();
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 7);
  let expenseDueCount = 0;
  let loanDueCount = 0;
  let adminPresence: Array<{ name: string; lastSeenAt: Date | null; lastLoginAt: Date | null }> = [];
  let supplierOverdueCount = 0;
  let supplierDueSoonCount = 0;
  let supplierDueCount = 0;
  try {
    [expenseDueCount, loanDueCount, adminPresence, supplierOverdueCount, supplierDueSoonCount, supplierDueCount] = await Promise.all([
      prisma.expense.count({
        where: {
          paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
          dueDate: { lte: soon },
          ...(storeId ? { storeId } : {})
        }
      }),
      prisma.loan.count({
        where: { remaining: { gt: 0 }, dueDate: { lte: soon }, ...(storeId ? { storeId } : {}) }
      }),
      prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true, ...(storeId ? { storeId } : {}) },
        select: { name: true, lastSeenAt: true, lastLoginAt: true }
      }),
      prisma.supplier.count({
        where: { unpaidAmount: { gt: 0 }, dueDate: { lte: now }, ...(storeId ? { storeId } : {}) }
      }),
      prisma.supplier.count({
        where: { unpaidAmount: { gt: 0 }, dueDate: { gt: now, lte: soon }, ...(storeId ? { storeId } : {}) }
      }),
      prisma.supplier.count({
        where: { unpaidAmount: { gt: 0 }, ...(storeId ? { storeId } : {}) }
      })
    ]);
  } catch {
    /* optional tables */
  }

  return {
    todaySales: Number(stats.today_sales || 0),
    todayOrderCount: Number(stats.today_count || 0),
    lastMonthSales: Number(stats.last_month_sales || 0),
    lastMonthOrderCount: Number(stats.last_month_count || 0),
    thisMonthSales: Number(stats.this_month_sales || 0),
    lastMonthLabel: lastMonthStart.toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
    stockValue,
    clockedIn,
    pendingDues: pendingSalary._sum.dueAmount || 0,
    lowStock: lowStock.length ? lowStock : Array.from({ length: lowCount }, (_, i) => ({ id: String(i) })),
    staffDayCards,
    recentOrders: recentOrders.map((o) => ({
      _id: o.id,
      id: o.id,
      orderNumber: o.invoiceNumber,
      invoiceNumber: o.invoiceNumber,
      customer: o.customer,
      items: { length: o._count.items },
      total: o.total,
      status: o.status,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt,
      saleDate: o.saleDate
    })),
    activities: unreadNotifications,
    weeklySales,
    trendingProducts,
    unpaidSaleCount,
    pendingManualCount,
    pendingDocCount,
    pendingRequestCount,
    needInfoRequestCount,
    readyRequestCount,
    overdueRequestCount,
    clockedOutToday,
    attendanceToday: todayAttendance.length,
    onTimeToday,
    expenseDueCount,
    loanDueCount,
    adminPresence,
    supplierOverdueCount,
    supplierDueSoonCount,
    supplierDueCount,
    storeClosingSoon: hour >= 23,
    access: {
      sales: canSeeSales,
      attendance: canSeeAttendance,
      payroll: canSeePayroll,
      cost: canSeeCost
    }
  };
}
