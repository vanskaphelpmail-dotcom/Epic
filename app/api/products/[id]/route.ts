import { errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission, requirePermission } from '@/services/auth.service';
import { getProductById, toStaffSafeProduct, updateProduct } from '@/services/product.service';
import { saveOptionalProductImage } from '@/lib/uploads';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAnyPermission('PRODUCT_VIEW', 'POS_ACCESS', 'INVENTORY_VIEW');
    const { id } = await ctx.params;
    const product = await getProductById(id, user.storeId);
    const canSeeCost = user.role === 'ADMIN' || user.permissions.includes('COST_VIEW');
    return ok(toStaffSafeProduct(product, canSeeCost));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('PRODUCT_CREATE');
    const { id } = await ctx.params;
    const contentType = req.headers.get('content-type') || '';
    let body: Record<string, unknown> = {};
    let image: string | undefined | null;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      body = Object.fromEntries(
        [...form.entries()]
          .filter(([, v]) => typeof v === 'string')
          .map(([k, v]) => [k, v])
      );
      const file = form.get('image');
      if (file instanceof File && file.size > 0) {
        image = await saveOptionalProductImage(file);
      } else if (body.clearImage === 'true') {
        image = null;
      }
    } else {
      body = await req.json();
      if (body.image === null || body.clearImage === true) image = null;
      else if (typeof body.image === 'string') image = body.image;
    }

    const product = await updateProduct(id, {
      name: body.name != null ? String(body.name) : undefined,
      brand: body.brand != null ? String(body.brand) : undefined,
      category: body.category != null ? String(body.category) : undefined,
      size: body.size != null ? String(body.size) : undefined,
      description: body.description != null ? String(body.description) : undefined,
      purchasePrice:
        body.purchasePrice != null || body.cost != null
          ? Number(body.purchasePrice || body.cost)
          : undefined,
      sellingPrice:
        body.sellingPrice != null || body.price != null
          ? Number(body.sellingPrice || body.price)
          : undefined,
      stockQuantity:
        body.stockQuantity != null || body.quantity != null
          ? Number(body.stockQuantity ?? body.quantity)
          : undefined,
      minimumStock: body.minimumStock != null ? Number(body.minimumStock) : undefined,
      supplierName: body.supplierName != null ? String(body.supplierName) : undefined,
      dupe: body.dupe != null ? String(body.dupe) : undefined,
      notes: body.notes != null ? String(body.notes) : undefined,
      season: body.season != null ? String(body.season) : undefined,
      spring: body.spring != null ? body.spring === true || body.spring === 'true' : undefined,
      summer: body.summer != null ? body.summer === true || body.summer === 'true' : undefined,
      autumn: body.autumn != null ? body.autumn === true || body.autumn === 'true' : undefined,
      winter: body.winter != null ? body.winter === true || body.winter === 'true' : undefined,
      allSeason: body.allSeason != null ? body.allSeason === true || body.allSeason === 'true' : undefined,
      mainAccords: body.mainAccords != null ? String(body.mainAccords) : undefined,
      isActive: body.isActive != null ? body.isActive === true || body.isActive === 'true' : undefined,
      barcode: body.barcode != null ? String(body.barcode) : undefined,
      image,
      userId: user.id,
      storeId: user.storeId
    });

    return ok(product);
  } catch (error) {
    return errorResponse(error);
  }
}
