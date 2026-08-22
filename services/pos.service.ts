import { randomInt } from 'crypto';
import { PaymentMethod, PaymentStatus, SalesChannel } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { roundMoney } from '@/lib/money';
import { writeAudit } from '@/services/audit.service';
import { nextInvoiceFromList } from '@/lib/invoice-number';
import { normalizePerfumeSize } from '@/lib/perfume-sizes';

const saleItemsInclude = { include: { product: { select: { size: true } } } };

async function nextInvoiceNumber(tx: { sale: { findMany: typeof prisma.sale.findMany } }) {
  const year = new Date().getFullYear();
  const rows = await tx.sale.findMany({
    where: { invoiceNumber: { startsWith: `INV-${year}-` } },
    select: { invoiceNumber: true }
  });
  return nextInvoiceFromList(rows.map((row) => row.invoiceNumber), year);
}

function isStaleTransaction(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string })?.code;
  return (
    code === 'P2028' ||
    /Transaction not found|Transaction API error|Transaction already closed|unable to start a transaction/i.test(
      message
    )
  );
}

function isInvoiceNumberClash(error: unknown) {
  const code = (error as { code?: string })?.code;
  const message = error instanceof Error ? error.message : String(error);
  return code === 'P2002' && /invoiceNumber/i.test(message);
}

export async function completeSale(input: {
  storeId: string;
  staffId: string;
  customerId?: string;
  customer?: { name?: string; phone?: string; email?: string; companyName?: string; address?: string; city?: string; location?: string };
  items: { productId?: string; quantity: number; name?: string; sellingPrice?: number; purchasePrice?: number; category?: string; size?: string; manual?: boolean }[];
  discount?: number;
  discountType?: 'PERCENT' | 'FIXED' | 'MANUAL';
  discountPercent?: number;
  allowDiscount: boolean;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
  cashReceived?: number;
  idempotencyKey?: string;
  taxRate?: number;
  /** Admin-only backdated sale timestamp */
  saleDate?: Date | string | null;
  allowBackdate?: boolean;
  channel?: SalesChannel;
}) {
  if (!input.items?.length) throw new AppError('VALIDATION_ERROR', 'At least one item is required');

  if (input.idempotencyKey) {
    const existing = await prisma.sale.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { items: saleItemsInclude, customer: true, staff: true, store: true }
    });
    if (existing) return existing;
  }

  const paymentStatus = input.paymentStatus === 'UNPAID' ? 'UNPAID' : 'PAID';
  if (paymentStatus === 'UNPAID') {
    const c = input.customer;
    if (!c?.name?.trim() || !c.phone?.trim()) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Due sales require customer name and mobile number'
      );
    }
    if (!c.city?.trim()) c.city = 'Cardiff';
    if (!c.location?.trim()) c.location = '136A Woodville Road';
  }
  const discountType = input.discountType || 'FIXED';
  const discountPercent = Math.max(0, Math.min(100, Number(input.discountPercent || 0)));
  let discount = Math.max(0, Number(input.discount || 0));
  if (discount > 0 && !input.allowDiscount) {
    throw new AppError('FORBIDDEN', 'Discount permission required', 403);
  }

  let saleDate = new Date();
  if (input.saleDate) {
    if (!input.allowBackdate) {
      throw new AppError('FORBIDDEN', 'Only admin can set a custom sale date/time', 403);
    }
    saleDate = new Date(input.saleDate);
    if (Number.isNaN(saleDate.getTime())) {
      throw new AppError('VALIDATION_ERROR', 'Invalid sale date/time');
    }
    const maxFuture = Date.now() + 5 * 60 * 1000;
    if (saleDate.getTime() > maxFuture) {
      throw new AppError('VALIDATION_ERROR', 'Sale date/time cannot be in the future');
    }
  }

  const runTx = () => prisma.$transaction(async (tx) => {
    let subtotal = 0;
    const saleItems: {
      productId: string;
      name: string;
      sku: string;
      barcode: string;
      quantity: number;
      sellingPrice: number;
      lineTotal: number;
      previousStock: number;
      newStock: number;
      purchasePrice: number;
    }[] = [];

    for (const line of input.items) {
      let product = line.productId ? await tx.product.findUnique({ where: { id: line.productId } }) : null;
      if (!product && line.manual) {
        if (!line.name?.trim() || !(Number(line.sellingPrice) >= 0)) {
          throw new AppError('VALIDATION_ERROR', 'Manual products need a name and valid price');
        }
        const manualName = line.name.trim();
        const barcode = String(randomInt(10_000_000, 99_999_999));
        product = await tx.product.create({
          data: {
            name: manualName,
            sku: `MAN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
            barcode,
            category: line.category || 'Manual',
            size: normalizePerfumeSize(line.size),
            purchasePrice: Number(line.purchasePrice || 0),
            sellingPrice: Number(line.sellingPrice),
            stockQuantity: Number(line.quantity),
            minimumStock: 0,
            storeId: input.storeId,
            isManualEntry: true,
            reviewStatus: 'PENDING'
          }
        });
        const admins = await tx.user.findMany({
          where: { storeId: input.storeId, role: 'ADMIN', isActive: true }, select: { id: true }
        });
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            storeId: input.storeId, userId: admin.id, title: 'Manual POS product needs review',
            message: `${manualName} was entered manually on a POS sale.`, type: 'MANUAL_PRODUCT'
          }))
        });
      }
      if (!product || !product.isActive) throw new AppError('NOT_FOUND', 'Product not found', 404);
      if (product.storeId !== input.storeId) {
        throw new AppError('FORBIDDEN', 'Product belongs to another store', 403);
      }
      if (line.quantity <= 0) throw new AppError('VALIDATION_ERROR', 'Invalid quantity');
      if (product.stockQuantity < line.quantity) {
        throw new AppError('INSUFFICIENT_STOCK', `Not enough stock for ${product.name}`);
      }

      const unitPrice = line.manual && line.sellingPrice != null ? Number(line.sellingPrice) : product.sellingPrice;
      const lineTotal = roundMoney(unitPrice * line.quantity);
      subtotal = roundMoney(subtotal + lineTotal);
      saleItems.push({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        quantity: line.quantity,
        sellingPrice: unitPrice,
        lineTotal,
        previousStock: product.stockQuantity,
        newStock: product.stockQuantity - line.quantity,
        purchasePrice: product.purchasePrice
      });
    }

    if (discountType === 'PERCENT') discount = roundMoney((subtotal * discountPercent) / 100);
    if (discount > subtotal) throw new AppError('VALIDATION_ERROR', 'Discount cannot exceed subtotal');

    // Shelf prices are VAT-inclusive (UK retail). Extract VAT from the gross total.
    const taxRate = Number(input.taxRate ?? 0);
    const total = roundMoney(subtotal - discount);
    const tax = roundMoney((total * taxRate) / (1 + taxRate));
    const net = roundMoney(total - tax);

    let cashReceived = input.cashReceived;
    let changeGiven: number | undefined;
    if (paymentStatus === 'PAID' && input.paymentMethod === 'CASH') {
      cashReceived = Number(cashReceived || 0);
      if (cashReceived < total) {
        throw new AppError('VALIDATION_ERROR', 'Cash received is less than total');
      }
      changeGiven = roundMoney(cashReceived - total);
    }

    let customerId = input.customerId;
    if (!customerId && input.customer && Object.values(input.customer).some((value) => String(value || '').trim())) {
      const customer = await tx.customer.create({
        data: {
          name: input.customer.name?.trim() || 'Walk-in customer', phone: input.customer.phone?.trim() || null,
          email: input.customer.email?.trim() || null, companyName: input.customer.companyName?.trim() || null,
          city: input.customer.city?.trim() || 'Cardiff',
          location: input.customer.location?.trim() || '136A Woodville Road', storeId: input.storeId
        }
      });
      customerId = customer.id;
    }

    const invoiceNumber = await nextInvoiceNumber(tx);
    const sale = await tx.sale.create({
      data: {
        invoiceNumber,
        storeId: input.storeId,
        staffId: input.staffId,
        customerId,
        subtotal: net,
        discount,
        discountType,
        discountPercent:
          discountType === 'PERCENT'
            ? discountPercent
            : subtotal > 0 && discount > 0
              ? roundMoney((discount / subtotal) * 100)
              : 0,
        taxRate,
        tax,
        total,
        paymentMethod: input.paymentMethod,
        paymentStatus,
        status: 'COMPLETED',
        cashReceived,
        changeGiven,
        currency: 'GBP',
        saleDate,
        createdAt: saleDate,
        channel: input.channel || 'IN_STORE',
        idempotencyKey: input.idempotencyKey,
        notes: input.saleDate && input.allowBackdate ? `Backdated sale by admin` : undefined,
        items: {
          create: saleItems.map((item) => ({
            productId: item.productId,
            name: item.name,
            sku: item.sku,
            barcode: item.barcode,
            quantity: item.quantity,
            sellingPrice: item.sellingPrice,
            lineTotal: item.lineTotal
          }))
        }
      },
      include: { items: saleItemsInclude, customer: true, staff: true, store: true }
    });

    for (const item of saleItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: item.newStock }
      });
      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          storeId: input.storeId,
          userId: input.staffId,
          type: 'SALE',
          quantity: item.quantity,
          previousStock: item.previousStock,
          newStock: item.newStock,
          costPrice: item.purchasePrice,
          sellingPrice: item.sellingPrice,
          reference: invoiceNumber,
          reason: 'POS sale'
        }
      });
    }

    if (paymentStatus === 'PAID') {
      await tx.accountEntry.create({
        data: {
          storeId: input.storeId,
          userId: input.staffId,
          type: 'SALE',
          amount: total,
          method: String(input.paymentMethod),
          reference: invoiceNumber,
          notes: 'POS sale'
        }
      });
    }

    if (paymentStatus === 'PAID' && input.paymentMethod === 'CASH') {
      const openSession = await tx.cashSession.findFirst({
        where: { storeId: input.storeId, employeeId: input.staffId, status: 'OPEN' }
      });
      await tx.cashTransaction.create({
        data: {
          storeId: input.storeId,
          sessionId: openSession?.id,
          userId: input.staffId,
          type: 'SALE',
          amount: total,
          reference: invoiceNumber,
          notes: 'POS cash sale'
        }
      });
    }

    if (customerId) {
      const pointsPerPound = 1;
      await tx.customer.update({
        where: { id: customerId },
        data: {
          totalPurchases: { increment: 1 },
          totalSpent: { increment: total },
          loyaltyPoints: { increment: Math.floor(total * pointsPerPound) }
        }
      });
    }

    return sale;
  }, { maxWait: 10_000, timeout: 20_000 });

  let sale;
  let lastError: unknown;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      sale = await runTx();
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (isStaleTransaction(error) || isInvoiceNumberClash(error)) continue;
      throw error;
    }
  }
  if (!sale) {
    if (isInvoiceNumberClash(lastError)) {
      throw new AppError('CONFLICT', 'Could not create the invoice number. Tap Paid again.', 409);
    }
    throw lastError;
  }

  await writeAudit({
    userId: input.staffId,
    storeId: input.storeId,
    action: 'SALE',
    entity: 'Sale',
    entityId: sale.id,
    newData: {
      invoiceNumber: sale.invoiceNumber,
      total: sale.total,
      saleDate: saleDate.toISOString(),
      backdated: !!input.allowBackdate && !!input.saleDate
    }
  });

  try {
    const { postPosSaleToLedger } = await import('@/services/money.service');
    await postPosSaleToLedger({
      storeId: input.storeId,
      userId: input.staffId,
      amount: sale.total,
      paymentMethod: sale.paymentMethod,
      invoiceNumber: sale.invoiceNumber,
      paymentStatus: sale.paymentStatus
    });
  } catch {
    /* accounts ledger must not block the sale */
  }

  return sale;
}
