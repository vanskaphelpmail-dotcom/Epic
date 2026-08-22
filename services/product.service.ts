import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { assertUniqueBarcode, generateUniqueBarcode, isValidBarcode } from '@/services/barcode.service';
import { writeAudit } from '@/services/audit.service';
import { normalizePerfumeSize } from '@/lib/perfume-sizes';

async function nextSku(prefix = 'PER') {
  const count = await prisma.product.count();
  return `${prefix}-${String(count + 1).padStart(6, '0')}`;
}

export async function listProducts(params: {
  q?: string;
  storeId?: string;
  includeInactive?: boolean;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, params.limit || 50);
  const where: Prisma.ProductWhereInput = {
    ...(params.storeId ? { storeId: params.storeId } : {}),
    ...(params.includeInactive ? {} : { isActive: true }),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: 'insensitive' } },
            { sku: { contains: params.q, mode: 'insensitive' } },
            { barcode: { contains: params.q, mode: 'insensitive' } },
            { brand: { contains: params.q, mode: 'insensitive' } },
            { category: { contains: params.q, mode: 'insensitive' } }
          ]
        }
      : {})
  };

  const items = await prisma.product.findMany({
    where,
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { updatedAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit
  });
  const total =
    items.length < limit && page === 1 ? items.length : await prisma.product.count({ where });

  return { items, total, page, limit };
}

export async function createProduct(input: {
  name: string;
  sku?: string;
  barcode?: string;
  autoBarcode?: boolean;
  brand?: string;
  category?: string;
  size?: string;
  description?: string;
  purchasePrice?: number;
  sellingPrice: number;
  stockQuantity?: number;
  minimumStock?: number;
  supplierName?: string;
  dupe?: string;
  notes?: string;
  season?: string;
  spring?: boolean;
  summer?: boolean;
  autumn?: boolean;
  winter?: boolean;
  allSeason?: boolean;
  mainAccords?: string;
  image?: string;
  storeId: string;
  userId: string;
}) {
  if (!input.name?.trim()) throw new AppError('VALIDATION_ERROR', 'Product name is required');
  if (!(Number(input.sellingPrice) >= 0)) throw new AppError('VALIDATION_ERROR', 'Selling price is invalid');

  let barcode = input.barcode?.trim();
  if (input.autoBarcode || !barcode) barcode = await generateUniqueBarcode();
  else await assertUniqueBarcode(barcode);

  const sku = (input.sku || (await nextSku())).toUpperCase();
  const existingSku = await prisma.product.findUnique({ where: { sku } });
  if (existingSku) throw new AppError('INVALID_SKU', 'SKU already exists');

  const supplier = await resolveSupplier(input.storeId, input.supplierName);
  const now = new Date();
  const product = await prisma.product.create({
    data: {
      name: input.name.trim(),
      sku,
      barcode: barcode!,
      brand: input.brand,
      category: input.category,
      size: normalizePerfumeSize(input.size),
      description: input.description,
      purchasePrice: Number(input.purchasePrice || 0),
      sellingPrice: Number(input.sellingPrice),
      stockQuantity: Number(input.stockQuantity || 0),
      minimumStock: Number(input.minimumStock ?? 5),
      image: input.image,
      storeId: input.storeId, supplierId: supplier?.id,
      dupe: clean(input.dupe), notes: clean(input.notes), season: clean(input.season),
      spring: !!input.spring, summer: !!input.summer, autumn: !!input.autumn, winter: !!input.winter,
      allSeason: !!input.allSeason, mainAccords: clean(input.mainAccords),
      lastStockUpdatedAt: now, lastStockAddedAt: Number(input.stockQuantity || 0) > 0 ? now : null,
      createdById: input.userId,
      updatedById: input.userId
    }
  });

  if (product.stockQuantity > 0) {
    await prisma.inventoryMovement.create({
      data: {
        productId: product.id,
        storeId: product.storeId,
        userId: input.userId,
        type: 'INITIAL_STOCK',
        quantity: product.stockQuantity,
        previousStock: 0,
        newStock: product.stockQuantity,
        costPrice: product.purchasePrice,
        sellingPrice: product.sellingPrice,
        reason: `Initial stock${supplier ? ` · Supplier: ${supplier.name}` : ''}`
      }
    });
  }

  await writeAudit({
    userId: input.userId,
    storeId: input.storeId,
    action: 'PRODUCT_CREATE',
    entity: 'Product',
    entityId: product.id,
    newData: { sku: product.sku, barcode: product.barcode }
  });

  return product;
}

export async function updateProduct(
  id: string,
  input: {
    name?: string;
    brand?: string;
    category?: string;
    size?: string;
    description?: string;
    purchasePrice?: number;
    sellingPrice?: number;
    stockQuantity?: number;
    minimumStock?: number;
    supplierName?: string;
    dupe?: string;
    notes?: string;
    season?: string;
    spring?: boolean;
    summer?: boolean;
    autumn?: boolean;
    winter?: boolean;
    allSeason?: boolean;
    mainAccords?: string;
    isActive?: boolean;
    image?: string | null;
    barcode?: string;
    userId: string;
    storeId?: string | null;
  }
) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new AppError('NOT_FOUND', 'Product not found', 404);
  if (input.storeId && existing.storeId !== input.storeId) {
    throw new AppError('NOT_FOUND', 'Product not found', 404);
  }

  if (input.barcode && input.barcode !== existing.barcode) {
    await assertUniqueBarcode(input.barcode, id);
  }

  const nextStock =
    input.stockQuantity != null ? Number(input.stockQuantity) : existing.stockQuantity;

  const supplier = input.supplierName !== undefined ? await resolveSupplier(existing.storeId, input.supplierName) : undefined;
  const now = new Date();
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: input.name?.trim() || existing.name,
      brand: input.brand ?? existing.brand,
      category: input.category ?? existing.category,
      size: input.size != null ? normalizePerfumeSize(input.size) : existing.size,
      description: input.description ?? existing.description,
      purchasePrice:
        input.purchasePrice != null ? Number(input.purchasePrice) : existing.purchasePrice,
      sellingPrice:
        input.sellingPrice != null ? Number(input.sellingPrice) : existing.sellingPrice,
      stockQuantity: nextStock,
      minimumStock:
        input.minimumStock != null ? Number(input.minimumStock) : existing.minimumStock,
      barcode: input.barcode || existing.barcode,
      updatedById: input.userId,
      ...(supplier !== undefined ? { supplierId: supplier?.id || null } : {}),
      ...(input.dupe !== undefined ? { dupe: clean(input.dupe) } : {}),
      ...(input.notes !== undefined ? { notes: clean(input.notes) } : {}),
      ...(input.season !== undefined ? { season: clean(input.season) } : {}),
      ...(input.spring !== undefined ? { spring: !!input.spring } : {}),
      ...(input.summer !== undefined ? { summer: !!input.summer } : {}),
      ...(input.autumn !== undefined ? { autumn: !!input.autumn } : {}),
      ...(input.winter !== undefined ? { winter: !!input.winter } : {}),
      ...(input.allSeason !== undefined ? { allSeason: !!input.allSeason } : {}),
      ...(input.mainAccords !== undefined ? { mainAccords: clean(input.mainAccords) } : {}),
      ...(input.isActive !== undefined ? { isActive: !!input.isActive } : {}),
      ...(nextStock !== existing.stockQuantity ? {
        lastStockUpdatedAt: now,
        ...(nextStock > existing.stockQuantity ? { lastStockAddedAt: now } : {})
      } : {}),
      ...(input.image !== undefined ? { image: input.image || null } : {})
    }
  });

  if (nextStock !== existing.stockQuantity) {
    await prisma.inventoryMovement.create({
      data: {
        productId: product.id,
        storeId: product.storeId,
        userId: input.userId,
        type: 'ADJUSTMENT',
        quantity: Math.abs(nextStock - existing.stockQuantity),
        previousStock: existing.stockQuantity,
        newStock: nextStock,
        costPrice: product.purchasePrice,
        sellingPrice: product.sellingPrice,
        reason: `Product edit stock adjustment${supplier || existing.supplierId ? ' · Supplier linked' : ''}`
      }
    });
  }

  await writeAudit({
    userId: input.userId,
    storeId: product.storeId,
    action: 'PRODUCT_UPDATE',
    entity: 'Product',
    entityId: product.id
  });

  return product;
}

export async function getProductById(id: string, storeId?: string | null) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true } },
      store: { select: { name: true, city: true, address: true } }
    }
  });
  if (!product) throw new AppError('NOT_FOUND', 'Product not found', 404);
  if (storeId && product.storeId !== storeId) {
    throw new AppError('NOT_FOUND', 'Product not found', 404);
  }
  return product;
}

export async function findSellableByBarcode(barcode: string, storeId?: string) {
  const code = String(barcode || '').trim();
  if (!code) throw new AppError('INVALID_BARCODE', 'Barcode is required');
  const product = await prisma.product.findFirst({
    where: {
      OR: [{ barcode: code }, { sku: code.toUpperCase() }, { sku: code }],
      isActive: true,
      ...(storeId ? { storeId } : {})
    }
  });
  if (!product) throw new AppError('NOT_FOUND', 'Product not found', 404);
  return product;
}

export function toStaffSafeProduct(product: {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  description: string | null;
  sellingPrice: number;
  stockQuantity: number;
  image: string | null;
  storeId: string;
  isActive: boolean;
  isManualEntry?: boolean;
  reviewStatus?: string;
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
  dupe?: string | null;
  notes?: string | null;
  season?: string | null;
  spring?: boolean;
  summer?: boolean;
  autumn?: boolean;
  winter?: boolean;
  allSeason?: boolean;
  mainAccords?: string | null;
  lastStockUpdatedAt?: Date | null;
  lastStockAddedAt?: Date | null;
  purchasePrice?: number;
  minimumStock?: number;
}, canSeeCost: boolean) {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    brand: product.brand,
    category: product.category,
    size: product.size,
    description: product.description,
    sellingPrice: product.sellingPrice,
    stockQuantity: product.stockQuantity,
    minimumStock: product.minimumStock,
    image: product.image,
    storeId: product.storeId,
    isActive: product.isActive,
    isManualEntry: product.isManualEntry,
    reviewStatus: product.reviewStatus,
    supplierId: product.supplierId,
    supplier: product.supplier,
    supplierName: product.supplier?.name || null,
    dupe: product.dupe, notes: product.notes, season: product.season,
    spring: product.spring, summer: product.summer, autumn: product.autumn, winter: product.winter, allSeason: product.allSeason,
    mainAccords: product.mainAccords, lastStockUpdatedAt: product.lastStockUpdatedAt, lastStockAddedAt: product.lastStockAddedAt,
    ...(canSeeCost ? { purchasePrice: product.purchasePrice } : {})
  };
}

function clean(value?: string) {
  const result = value?.trim();
  return result || null;
}

async function resolveSupplier(storeId: string, supplierName?: string) {
  const name = supplierName?.trim();
  if (!name) return null;
  const existing = await prisma.supplier.findFirst({ where: { storeId, name: { equals: name, mode: 'insensitive' } } });
  return existing || prisma.supplier.create({ data: { storeId, name } });
}

export async function restockProduct(input: {
  id: string;
  quantity: number;
  type: 'RETURN' | 'PURCHASE' | 'ADJUSTMENT';
  reason?: string;
  userId: string;
}) {
  const qty = Math.floor(Number(input.quantity));
  if (!(qty > 0)) throw new AppError('VALIDATION_ERROR', 'Return quantity must be at least 1');
  const existing = await prisma.product.findUnique({ where: { id: input.id } });
  if (!existing) throw new AppError('NOT_FOUND', 'Product not found', 404);
  const now = new Date();
  const nextStock = existing.stockQuantity + qty;
  const product = await prisma.product.update({
    where: { id: input.id },
    data: {
      stockQuantity: nextStock,
      lastStockUpdatedAt: now,
      lastStockAddedAt: now
    }
  });
  await prisma.inventoryMovement.create({
    data: {
      productId: product.id,
      storeId: product.storeId,
      userId: input.userId,
      type: input.type,
      quantity: qty,
      previousStock: existing.stockQuantity,
      newStock: nextStock,
      costPrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      reason: input.reason || 'Inventory return'
    }
  });
  await writeAudit({
    userId: input.userId,
    storeId: product.storeId,
    action: 'INVENTORY_RETURN',
    entity: 'Product',
    entityId: product.id,
    newData: { quantity: qty, type: input.type, previousStock: existing.stockQuantity, newStock: nextStock }
  });
  return product;
}

export { isValidBarcode };
