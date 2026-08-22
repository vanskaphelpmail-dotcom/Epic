import { Router } from "express";
import { prisma } from "@jab/db";
import { requireStaff } from "../middleware/auth";
import { requireAnyPermission } from "../lib/permissions";

export const adminRouter = Router();

adminRouter.get(
  "/stats",
  requireAnyPermission("can_export_reports", "can_manage_orders", "can_manage_products"),
  async (_req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [
      orderAgg,
      monthAgg,
      productCount,
      customerCount,
      lowStock,
      outOfStock,
      pendingOrders,
      recentOrders,
      monthlyBuckets,
    ] = await Promise.all([
      prisma.order.aggregate({
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { createdAt: { gte: startOfMonth } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.product.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.product.count({
        where: {
          deletedAt: null,
          stock: { gt: 0, lte: 3 },
        },
      }),
      prisma.product.count({ where: { deletedAt: null, stock: 0 } }),
      prisma.order.count({
        where: { status: { in: ["PENDING", "CONFIRMED", "PROCESSING", "PACKED"] } },
      }),
      prisma.order.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          shipFullName: true,
          createdAt: true,
        },
      }),
      // DB-side monthly buckets — avoids loading every order row into Node (timeout with volume)
      prisma.$queryRaw<Array<{ ym: string; sales: bigint; revenue: unknown }>>`
        SELECT
          to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS ym,
          COUNT(*) FILTER (WHERE "status"::text NOT IN ('CANCELLED', 'REFUNDED'))::bigint AS sales,
          COALESCE(SUM("total") FILTER (WHERE "status"::text NOT IN ('CANCELLED', 'REFUNDED')), 0) AS revenue
        FROM "orders"
        WHERE "createdAt" >= ${twelveMonthsAgo}
        GROUP BY 1
        ORDER BY 1
      `,
    ]);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const trendsMap = new Map<string, { sales: number; revenue: number; label: string }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      trendsMap.set(key, { sales: 0, revenue: 0, label: monthNames[d.getMonth()] });
    }
    for (const row of monthlyBuckets) {
      const bucket = trendsMap.get(row.ym);
      if (!bucket) continue;
      bucket.sales = Number(row.sales) || 0;
      bucket.revenue = Math.round(Number(row.revenue) || 0);
    }
    const monthlyTrends = [...trendsMap.values()].map((v) => ({
      month: v.label,
      sales: v.sales,
      revenue: v.revenue,
    }));

    const revenue = Number(orderAgg._sum.total || 0);
    const expense = Math.round(revenue * 0.42);
    const profit = Math.round(revenue - expense);

    return res.json({
      success: true,
      data: {
        revenue: Math.round(revenue),
        monthRevenue: Math.round(Number(monthAgg._sum.total || 0)),
        orderCount: orderAgg._count,
        monthOrderCount: monthAgg._count,
        productCount,
        customerCount,
        lowStockCount: lowStock,
        outOfStockCount: outOfStock,
        pendingOrdersCount: pendingOrders,
        expense,
        profit,
        monthlyTrends,
        recentOrders: recentOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          total: Number(o.total),
          customer: o.shipFullName,
          createdAt: o.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("[GET /admin/stats]", error);
    return res.status(500).json({ success: false, error: { message: "Failed to load stats" } });
  }
});
