import { AppError, errorResponse, ok } from '@/lib/errors';
import { requireUser } from '@/services/auth.service';
import { prisma } from '@/lib/prisma';
import { ensureFeaturedProducts } from '@/prisma/seed-demo';

/** Admin: upsert featured products (Non Stop, Ansaam Gold, …) with cost/stock/image. */
export async function POST() {
  try {
    const user = await requireUser();
    if (user.role !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 'Only admin can upsert featured products', 403);
    }
    if (!user.storeId) throw new AppError('VALIDATION_ERROR', 'Store is required');

    const products = await ensureFeaturedProducts(prisma, user.storeId);
    return ok({
      message: `Saved ${products.length} featured product(s)`,
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        size: product.size,
        sellingPrice: product.sellingPrice,
        purchasePrice: product.purchasePrice,
        stockQuantity: product.stockQuantity,
        image: product.image
      }))
    });
  } catch (error) {
    return errorResponse(error);
  }
}
