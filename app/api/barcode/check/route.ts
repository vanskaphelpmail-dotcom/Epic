import { AppError, errorResponse, ok } from '@/lib/errors';
import { requireAnyPermission } from '@/services/auth.service';
import {
  checkBarcodeAvailability,
  generateUniqueBarcode,
  normalizeBarcode
} from '@/services/barcode.service';

export async function GET(req: Request) {
  try {
    await requireAnyPermission('PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_EDIT', 'INVENTORY_VIEW', 'POS_ACCESS');
    const { searchParams } = new URL(req.url);
    if (searchParams.get('generate') === '1') {
      const barcode = await generateUniqueBarcode();
      return ok({ barcode, auto: true });
    }
    const code = normalizeBarcode(searchParams.get('code') || '');
    if (!code) throw new AppError('VALIDATION_ERROR', 'Barcode is required');
    const result = await checkBarcodeAvailability(code, searchParams.get('excludeId') || undefined);
    return ok(result);
  } catch (error) {
    return errorResponse(error);
  }
}
