import { AppError, errorResponse, ok } from '@/lib/errors';
import { requireUser } from '@/services/auth.service';
import { prisma } from '@/lib/prisma';
import { ensureFeaturedProducts, seedDemoOperations } from '@/prisma/seed-demo';

/** Admin-only: load 7-day UK sales/attendance + monthly payroll demo data. */
export async function POST() {
  try {
    const user = await requireUser();
    if (user.role !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 'Only shop admin can load demo data', 403);
    }
    if (!user.storeId) throw new AppError('VALIDATION_ERROR', 'Store is required');

    // Allow re-seed: clear previous DEMO-7D rows then recreate
    const sales = await prisma.sale.findMany({
      where: { storeId: user.storeId, notes: { contains: 'DEMO-7D' } },
      select: { id: true }
    });
    const saleIds = sales.map((s) => s.id);
    if (saleIds.length) {
      await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
      await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
    }

    const attendances = await prisma.attendance.findMany({
      where: { storeId: user.storeId, notes: { contains: 'DEMO-7D' } },
      select: { id: true }
    });
    const attIds = attendances.map((a) => a.id);
    if (attIds.length) {
      await prisma.cashSession.deleteMany({ where: { attendanceId: { in: attIds } } });
      await prisma.attendance.deleteMany({ where: { id: { in: attIds } } });
    }

    await prisma.salaryRecord.deleteMany({
      where: { storeId: user.storeId, notes: { contains: 'DEMO-7D' } }
    });

    const featured = await ensureFeaturedProducts(prisma, user.storeId);
    await seedDemoOperations(prisma, user.storeId);

    return ok({
      message:
        'Demo data loaded: featured products, 7-day UK sales & attendance, monthly payroll full/partial',
      timezone: 'Europe/London',
      products: featured.map((p) => ({
        name: p.name,
        brand: p.brand,
        category: p.category,
        sellingPrice: p.sellingPrice,
        purchasePrice: p.purchasePrice,
        stockQuantity: p.stockQuantity
      }))
    });
  } catch (error) {
    return errorResponse(error);
  }
}
