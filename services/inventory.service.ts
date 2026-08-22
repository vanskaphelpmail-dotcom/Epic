import { InventoryMovementType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { writeAudit } from '@/services/audit.service';

export async function adjustStock(input: {
  productId: string;
  storeId: string;
  userId: string;
  type: InventoryMovementType;
  quantity: number;
  reason: string;
  reference?: string;
}) {
  if (input.quantity <= 0) throw new AppError('VALIDATION_ERROR', 'Quantity must be positive');

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new AppError('NOT_FOUND', 'Product not found', 404);

    const delta =
      input.type === 'DAMAGE' || input.type === 'SALE' || input.type === 'TRANSFER'
        ? -input.quantity
        : input.quantity;

    const newStock = product.stockQuantity + delta;
    if (newStock < 0) throw new AppError('INSUFFICIENT_STOCK', 'Stock would become negative');

    const updated = await tx.product.update({
      where: { id: product.id },
      data: { stockQuantity: newStock, lastStockUpdatedAt: new Date(), ...(delta > 0 ? { lastStockAddedAt: new Date() } : {}) }
    });

    await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        storeId: input.storeId,
        userId: input.userId,
        type: input.type,
        quantity: input.quantity,
        previousStock: product.stockQuantity,
        newStock,
        costPrice: product.purchasePrice,
        sellingPrice: product.sellingPrice,
        reason: input.reason,
        reference: input.reference
      }
    });

    await writeAudit({
      userId: input.userId,
      storeId: input.storeId,
      action: 'STOCK_ADJUSTMENT',
      entity: 'Product',
      entityId: product.id,
      newData: { previousStock: product.stockQuantity, newStock, type: input.type }
    });

    return updated;
  });
}
