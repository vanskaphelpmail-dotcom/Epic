import { randomInt } from 'crypto';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';

export function normalizeBarcode(raw: string) {
  return String(raw || '').trim();
}

/** EAN-8, EAN-13, UPC-A, or Code 128 used by shop scanners. */
export function isValidBarcode(barcode: string) {
  const code = normalizeBarcode(barcode);
  if (code.length < 4 || code.length > 32) return false;
  if (/^\d{8}$/.test(code)) return true;
  if (/^\d{12}$/.test(code)) return true;
  if (/^\d{13}$/.test(code)) return true;
  return /^[A-Za-z0-9._-]{4,32}$/.test(code);
}

export async function generateUniqueBarcode(maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const code = String(randomInt(10_000_000, 99_999_999));
    const exists = await prisma.product.findUnique({ where: { barcode: code } });
    if (!exists) return code;
  }
  throw new AppError('DUPLICATE_BARCODE', 'Could not generate a unique barcode', 500);
}

export async function assertUniqueBarcode(barcode: string, excludeId?: string) {
  const code = normalizeBarcode(barcode);
  if (!isValidBarcode(code)) {
    throw new AppError(
      'INVALID_BARCODE',
      'Barcode must be a unique EAN-8, EAN-13, UPC, or Code 128 value'
    );
  }
  const existing = await prisma.product.findFirst({
    where: {
      barcode: code,
      ...(excludeId ? { NOT: { id: excludeId } } : {})
    },
    select: { id: true, name: true }
  });
  if (existing) {
    throw new AppError('DUPLICATE_BARCODE', `Barcode already used by ${existing.name}`, 409);
  }
}

export async function checkBarcodeAvailability(barcode: string, excludeId?: string) {
  const code = normalizeBarcode(barcode);
  if (!code) return { code, valid: false, available: false, message: 'Enter a barcode' };
  if (!isValidBarcode(code)) {
    return { code, valid: false, available: false, message: 'Invalid barcode format' };
  }
  try {
    await assertUniqueBarcode(code, excludeId);
    return { code, valid: true, available: true, message: 'Barcode is available' };
  } catch (error) {
    const message = error instanceof AppError ? error.message : 'Barcode is not available';
    return { code, valid: true, available: false, message };
  }
}
