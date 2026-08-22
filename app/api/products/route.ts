import { AppError, errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission, requirePermission } from '@/services/auth.service';
import { createProduct, listProducts, toStaffSafeProduct } from '@/services/product.service';
import { saveOptionalProductImage } from '@/lib/uploads';

export async function GET(req: Request) {
  try {
    const user = await requireAnyPermission('PRODUCT_VIEW', 'POS_ACCESS', 'INVENTORY_VIEW');
    const { searchParams } = new URL(req.url);
    const result = await listProducts({
      q: searchParams.get('q') || undefined,
      storeId: searchParams.get('storeId') || user.storeId || undefined,
      page: Number(searchParams.get('page') || 1),
      limit: Number(searchParams.get('limit') || 100)
      , includeInactive: searchParams.get('includeInactive') === 'true'
    });
    const canSeeCost = user.role === 'ADMIN' || user.permissions.includes('COST_VIEW');
    return ok({
      ...result,
      items: result.items.map((p) => toStaffSafeProduct(p, canSeeCost))
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requirePermission('PRODUCT_CREATE');
    const contentType = req.headers.get('content-type') || '';
    let body: Record<string, unknown> = {};
    let image: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      body = Object.fromEntries(
        [...form.entries()]
          .filter(([, v]) => typeof v === 'string')
          .map(([k, v]) => [k, v])
      );
      image = await saveOptionalProductImage(form.get('image') as File | null);
    } else {
      body = await req.json();
    }

    if (!user.storeId && !body.storeId) {
      throw new AppError('VALIDATION_ERROR', 'Store is required');
    }

    const product = await createProduct({
      name: String(body.name || ''),
      sku: body.sku ? String(body.sku) : undefined,
      barcode: body.barcode ? String(body.barcode) : undefined,
      autoBarcode: body.autoBarcode === true || body.autoBarcode === 'true' || !body.barcode,
      brand: body.brand ? String(body.brand) : undefined,
      category: body.category ? String(body.category) : undefined,
      size: body.size ? String(body.size) : undefined,
      description: body.description ? String(body.description) : undefined,
      purchasePrice: Number(body.purchasePrice || body.cost || 0),
      sellingPrice: Number(body.sellingPrice || body.price || 0),
      stockQuantity: Number(body.stockQuantity || body.quantity || 0),
      minimumStock: body.minimumStock != null ? Number(body.minimumStock) : undefined,
      supplierName: body.supplierName ? String(body.supplierName) : undefined,
      dupe: body.dupe ? String(body.dupe) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
      season: body.season ? String(body.season) : undefined,
      spring: body.spring === true || body.spring === 'true', summer: body.summer === true || body.summer === 'true',
      autumn: body.autumn === true || body.autumn === 'true', winter: body.winter === true || body.winter === 'true',
      allSeason: body.allSeason === true || body.allSeason === 'true', mainAccords: body.mainAccords ? String(body.mainAccords) : undefined,
      image,
      storeId: String(body.storeId || user.storeId),
      userId: user.id
    });

    return ok(product, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
