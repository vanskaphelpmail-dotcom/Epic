import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { roundMoney } from '@/lib/money';
import { writeAudit } from '@/services/audit.service';

export async function listSales(params: {
  storeId?: string;
  staffId?: string;
  limit?: number;
  from?: Date;
  to?: Date;
  q?: string;
  paymentStatus?: 'PAID' | 'UNPAID';
}) {
  return prisma.sale.findMany({
    where: {
      ...(params.storeId ? { storeId: params.storeId } : {}),
      ...(params.staffId ? { staffId: params.staffId } : {}),
      ...(params.paymentStatus ? { paymentStatus: params.paymentStatus } : {}),
      ...(params.q
        ? { OR: [
            { invoiceNumber: { contains: params.q, mode: 'insensitive' } },
            { customer: { is: { name: { contains: params.q, mode: 'insensitive' } } } },
            { customer: { is: { phone: { contains: params.q, mode: 'insensitive' } } } }
          ] }
        : {}),
      ...(params.from || params.to
        ? {
            saleDate: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {})
            }
          }
        : {})
    },
    include: {
      items: { include: { product: { select: { size: true } } } },
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          companyName: true,
          address: true,
          city: true,
          location: true
        }
      },
      staff: { select: { id: true, name: true, employeeId: true } }
    },
    orderBy: { saleDate: 'desc' },
    take: Math.min(params.limit || 50, 200)
  });
}

export async function findSaleByInvoiceNumber(invoiceNumber: string, storeId?: string) {
  const sale = await prisma.sale.findFirst({
    where: {
      invoiceNumber: invoiceNumber.trim(),
      ...(storeId ? { storeId } : {})
    },
    include: { items: { include: { product: { select: { size: true } } } }, customer: true, staff: true }
  });
  if (!sale) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
  return sale;
}

function recalculateTotals(
  items: { sellingPrice: number; quantity: number }[],
  discountInput: { type: 'fixed' | 'percent'; value: number },
  taxRate: number,
  deliveryCharge = 0
) {
  const subtotal = roundMoney(
    items.reduce((sum, i) => sum + i.sellingPrice * i.quantity, 0)
  );
  let discount = 0;
  if (discountInput.type === 'percent') {
    const pct = Math.max(0, Math.min(100, Number(discountInput.value) || 0));
    discount = roundMoney((subtotal * pct) / 100);
  } else {
    discount = roundMoney(Math.max(0, Number(discountInput.value) || 0));
  }
  if (discount > subtotal) throw new AppError('VALIDATION_ERROR', 'Discount cannot exceed subtotal');
  const net = roundMoney(subtotal - discount);
  const tax = roundMoney(net * taxRate);
  const delivery = roundMoney(Math.max(0, Number(deliveryCharge) || 0));
  const total = roundMoney(net + tax + delivery);
  return { subtotal, discount, tax, delivery, total };
}

async function recordRevision(input: {
  saleId: string;
  userId: string;
  action: string;
  reason?: string | null;
  notes?: string | null;
  previousTotal: number;
  updatedTotal: number;
  snapshot: unknown;
}) {
  const count = await prisma.saleRevision.count({ where: { saleId: input.saleId } });
  await prisma.saleRevision.create({
    data: {
      saleId: input.saleId,
      userId: input.userId,
      version: count + 1,
      action: input.action,
      reason: input.reason || null,
      notes: input.notes || null,
      previousTotal: input.previousTotal,
      updatedTotal: input.updatedTotal,
      snapshot: input.snapshot as object
    }
  });
}

async function postSaleMoney(input: {
  storeId: string;
  userId: string;
  typeKey: string;
  amount: number;
  method?: string;
  reference?: string;
  notes?: string;
  direction?: 'IN' | 'OUT';
}) {
  if (!(Number(input.amount) > 0)) return;
  try {
    const { postMoneyEntry } = await import('@/services/money.service');
    await postMoneyEntry({
      storeId: input.storeId,
      userId: input.userId,
      typeKey: input.typeKey,
      amount: Math.abs(Number(input.amount)),
      method: input.method,
      reference: input.reference,
      notes: input.notes,
      source: 'POS',
      direction: input.direction
    });
  } catch {
    /* money ledger optional */
  }
}

/** Full admin invoice edit: date/time, discount, line prices/qty, customer, notes. */
export async function updateSale(
  id: string,
  input: {
    customerName?: string;
    notes?: string;
    saleDate?: string | Date | null;
    discountType?: 'fixed' | 'percent';
    discountValue?: number;
    deliveryCharge?: number;
    taxRate?: number;
    paymentMethod?: string;
    paymentStatus?: string;
    reason?: string;
    items?: { id?: string; productId: string; quantity: number; sellingPrice: number }[];
    actorId: string;
    storeId?: string | null;
  }
) {
  const existing = await prisma.sale.findUnique({
    where: { id },
    include: { items: { include: { product: { select: { size: true } } } } }
  });
  if (!existing) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
  if (input.storeId && existing.storeId !== input.storeId) {
    throw new AppError('NOT_FOUND', 'Invoice not found', 404);
  }
  if (existing.status === 'VOID' || existing.status === 'REFUNDED') {
    throw new AppError('VALIDATION_ERROR', 'Cannot edit a void/refunded invoice');
  }

  let saleDate = existing.saleDate;
  if (input.saleDate) {
    const parsed = new Date(input.saleDate);
    if (Number.isNaN(parsed.getTime())) throw new AppError('VALIDATION_ERROR', 'Invalid sale date/time');
    if (parsed.getTime() > Date.now() + 5 * 60 * 1000) {
      throw new AppError('VALIDATION_ERROR', 'Sale date/time cannot be in the future');
    }
    saleDate = parsed;
  }

  const lineSource =
    input.items?.length
      ? input.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          quantity: Number(i.quantity),
          sellingPrice: Number(i.sellingPrice)
        }))
      : existing.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          quantity: i.quantity,
          sellingPrice: i.sellingPrice
        }));

  for (const line of lineSource) {
    if (!(line.quantity > 0) || !(line.sellingPrice >= 0)) {
      throw new AppError('VALIDATION_ERROR', 'Invalid item quantity or price');
    }
  }

  const currentDiscountType = input.discountType || 'fixed';
  const currentDiscountValue =
    input.discountValue != null
      ? Number(input.discountValue)
      : existing.discount;

  const totals = recalculateTotals(
    lineSource,
    { type: currentDiscountType, value: currentDiscountValue },
    input.taxRate != null ? Number(input.taxRate) : existing.taxRate,
    input.deliveryCharge != null ? Number(input.deliveryCharge) : existing.deliveryCharge
  );

  const updated = await prisma.$transaction(async (tx) => {
    // Adjust stock if quantities changed
    if (input.items?.length) {
      for (const original of existing.items) {
        const next = lineSource.find(
          (l) => l.productId === original.productId || l.id === original.id
        );
        const nextQty = next?.quantity ?? 0;
        const diff = original.quantity - nextQty;
        if (diff === 0) continue;
        const product = await tx.product.findUnique({ where: { id: original.productId } });
        if (!product) continue;
        if (diff < 0 && product.stockQuantity < Math.abs(diff)) {
          throw new AppError('INSUFFICIENT_STOCK', `Not enough stock for ${product.name}`);
        }
        const newStock = product.stockQuantity + diff;
        await tx.product.update({
          where: { id: product.id },
          data: { stockQuantity: newStock }
        });
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            storeId: existing.storeId,
            userId: input.actorId,
            type: 'ADJUSTMENT',
            quantity: Math.abs(diff),
            previousStock: product.stockQuantity,
            newStock,
            sellingPrice: next?.sellingPrice ?? original.sellingPrice,
            reference: existing.invoiceNumber,
            reason: 'Invoice edit quantity change'
          }
        });
      }

      // Replace line items
      await tx.saleItem.deleteMany({ where: { saleId: id } });
      for (const line of lineSource) {
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        await tx.saleItem.create({
          data: {
            saleId: id,
            productId: line.productId,
            name: product?.name || 'Item',
            sku: product?.sku,
            barcode: product?.barcode,
            quantity: line.quantity,
            sellingPrice: line.sellingPrice,
            lineTotal: roundMoney(line.sellingPrice * line.quantity)
          }
        });
      }
    } else if (!input.items?.length) {
      // Keep existing lines; totals still recalculated from current prices
    }

    if (input.customerName) {
      if (existing.customerId) {
        await tx.customer.update({
          where: { id: existing.customerId },
          data: { name: input.customerName }
        });
      } else {
        const customer = await tx.customer.create({
          data: { name: input.customerName, storeId: existing.storeId }
        });
        await tx.sale.update({
          where: { id },
          data: { customerId: customer.id }
        });
      }
    }

    const discountNote =
      input.discountType != null
        ? ` | Discount ${
            input.discountType === 'percent'
              ? `${input.discountValue}% (=£${totals.discount})`
              : `£${totals.discount} fixed`
          }`
        : '';
    const nextNotes =
      input.notes != null
        ? String(input.notes)
        : `${existing.notes || ''}${discountNote} | Edited by admin`.trim();

    return tx.sale.update({
      where: { id },
      data: {
        saleDate,
        subtotal: totals.subtotal,
        discount: totals.discount,
        discountType: currentDiscountType === 'percent' ? 'PERCENT' : 'FIXED',
        discountPercent: currentDiscountType === 'percent' ? currentDiscountValue : 0,
        tax: totals.tax,
        taxRate: input.taxRate != null ? Number(input.taxRate) : existing.taxRate,
        deliveryCharge: totals.delivery,
        total: totals.total,
        ...(input.paymentMethod ? { paymentMethod: input.paymentMethod as never } : {}),
        ...(input.paymentStatus ? { paymentStatus: input.paymentStatus as never } : {}),
        notes: nextNotes
      },
      include: { items: { include: { product: { select: { size: true } } } }, customer: true, staff: true }
    });
  });

  await recordRevision({
    saleId: existing.id,
    userId: input.actorId,
    action: 'SALE_EDIT',
    reason: input.reason,
    previousTotal: existing.total,
    updatedTotal: totals.total,
    snapshot: { before: existing.total, after: totals, items: lineSource }
  });
  const moneyDiff = roundMoney(totals.total - existing.total);
  if (moneyDiff !== 0) {
    await postSaleMoney({
      storeId: existing.storeId,
      userId: input.actorId,
      typeKey: moneyDiff > 0 ? 'SALES_INCOME' : 'REFUND_GIVEN',
      amount: Math.abs(moneyDiff),
      method: String(input.paymentMethod || existing.paymentMethod),
      reference: existing.invoiceNumber,
      notes: 'Sale edit total adjustment',
      direction: moneyDiff > 0 ? 'IN' : 'OUT'
    });
  }
  await writeAudit({
    userId: input.actorId,
    storeId: existing.storeId,
    action: 'SALE_EDIT',
    entity: 'Sale',
    entityId: existing.id,
    newData: {
      saleDate,
      ...totals,
      discountType: currentDiscountType,
      discountValue: currentDiscountValue
    }
  });
  return updated;
}

export async function voidSale(id: string, actorId: string, reason?: string, storeId?: string | null) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id },
      include: { items: { include: { product: { select: { size: true } } } } }
    });
    if (!sale) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    if (storeId && sale.storeId !== storeId) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    if (sale.status === 'VOID') throw new AppError('VALIDATION_ERROR', 'Invoice already voided');

    for (const item of sale.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) continue;
      const newStock = product.stockQuantity + item.quantity;
      await tx.product.update({
        where: { id: product.id },
        data: { stockQuantity: newStock }
      });
      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          storeId: sale.storeId,
          userId: actorId,
          type: 'RETURN',
          quantity: item.quantity,
          previousStock: product.stockQuantity,
          newStock,
          sellingPrice: item.sellingPrice,
          reference: sale.invoiceNumber,
          reason: 'Invoice void / delete — stock restored'
        }
      });
    }

    if (sale.paymentMethod === 'CASH') {
      await tx.cashTransaction.create({
        data: {
          storeId: sale.storeId,
          userId: actorId,
          type: 'REFUND',
          amount: sale.total,
          reference: sale.invoiceNumber,
          notes: 'Voided sale refund'
        }
      });
    }

    const updated = await tx.sale.update({
      where: { id },
      data: { status: 'VOID', paymentStatus: 'REFUNDED', cancelReason: reason || 'Cancelled by admin' },
      include: { items: { include: { product: { select: { size: true } } } }, customer: true, staff: true }
    });

    await writeAudit({
      userId: actorId,
      storeId: sale.storeId,
      action: 'SALE_DELETE',
      entity: 'Sale',
      entityId: sale.id,
      newData: { stockRestored: true }
    });
    return updated;
  });
}

export async function returnSaleItems(
  id: string,
  input: {
    items: { productId: string; quantity: number }[];
    actorId: string;
    reason?: string;
    condition?: string;
    refundMethod?: string;
    refundAmount?: number;
    notes?: string;
  }
) {
  if (!input.items?.length) throw new AppError('VALIDATION_ERROR', 'Return items required');

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id },
      include: { items: { include: { product: { select: { size: true } } } } }
    });
    if (!sale) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    if (sale.status === 'VOID') throw new AppError('VALIDATION_ERROR', 'Cannot return a voided invoice');

    let refund = 0;
    for (const line of input.items) {
      const original = sale.items.find((i) => i.productId === line.productId);
      if (!original) throw new AppError('VALIDATION_ERROR', 'Product not on original invoice');
      if (line.quantity <= 0 || line.quantity > original.quantity) {
        throw new AppError('VALIDATION_ERROR', 'Invalid return quantity');
      }
      const product = await tx.product.findUnique({ where: { id: line.productId } });
      if (!product) throw new AppError('NOT_FOUND', 'Product not found', 404);
      const newStock = product.stockQuantity + line.quantity;
      await tx.product.update({
        where: { id: product.id },
        data: { stockQuantity: newStock }
      });
      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          storeId: sale.storeId,
          userId: input.actorId,
          type: 'RETURN',
          quantity: line.quantity,
          previousStock: product.stockQuantity,
          newStock,
          sellingPrice: original.sellingPrice,
          reference: sale.invoiceNumber,
          reason: 'Customer return'
        }
      });
      refund = roundMoney(refund + original.sellingPrice * line.quantity);

      const remaining = original.quantity - line.quantity;
      if (remaining <= 0) {
        await tx.saleItem.delete({ where: { id: original.id } });
      } else {
        await tx.saleItem.update({
          where: { id: original.id },
          data: {
            quantity: remaining,
            lineTotal: roundMoney(original.sellingPrice * remaining)
          }
        });
      }
    }

    const tax = roundMoney(refund * sale.taxRate);
    const totalRefund = roundMoney(
      input.refundAmount != null ? Number(input.refundAmount) : refund + tax
    );

    if (sale.paymentMethod === 'CASH') {
      const openSession = await tx.cashSession.findFirst({
        where: { storeId: sale.storeId, status: 'OPEN' },
        orderBy: { openedAt: 'desc' }
      });
      await tx.cashTransaction.create({
        data: {
          storeId: sale.storeId,
          sessionId: openSession?.id,
          userId: input.actorId,
          type: 'REFUND',
          amount: totalRefund,
          reference: sale.invoiceNumber,
          notes: 'Partial/full return'
        }
      });
    }

    const remainingItems = await tx.saleItem.findMany({ where: { saleId: id } });
    const totals = recalculateTotals(
      remainingItems,
      { type: 'fixed', value: sale.discount },
      sale.taxRate,
      sale.deliveryCharge
    );

    const updated = await tx.sale.update({
      where: { id },
      data: {
        status: remainingItems.length ? sale.status : 'REFUNDED',
        paymentStatus: remainingItems.length ? sale.paymentStatus : 'REFUNDED',
        subtotal: totals.subtotal,
        discount: remainingItems.length ? Math.min(sale.discount, totals.subtotal) : 0,
        tax: remainingItems.length ? totals.tax : 0,
        total: remainingItems.length ? totals.total : 0,
        notes: `${sale.notes || ''} | Returned ${formatItems(input.items)}${input.reason ? ` · ${input.reason}` : ''}`.trim()
      },
      include: { items: { include: { product: { select: { size: true } } } }, customer: true, staff: true }
    });

    await writeAudit({
      userId: input.actorId,
      storeId: sale.storeId,
      action: 'SALE_RETURN',
      entity: 'Sale',
      entityId: sale.id,
      newData: { refund: totalRefund }
    });

    return { sale: updated, refund: totalRefund };
  });
}

/** Exchange: return product from invoice, add replacement product onto invoice + stock. */
export async function exchangeSaleItems(
  id: string,
  input: {
    returnProductId: string;
    returnQuantity: number;
    newProductId: string;
    newQuantity: number;
    newSellingPrice?: number;
    actorId: string;
  }
) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id },
      include: { items: { include: { product: { select: { size: true } } } } }
    });
    if (!sale) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    if (sale.status === 'VOID') throw new AppError('VALIDATION_ERROR', 'Cannot exchange a voided invoice');

    const original = sale.items.find((i) => i.productId === input.returnProductId);
    if (!original) throw new AppError('VALIDATION_ERROR', 'Exchange product not on invoice');
    if (input.returnQuantity <= 0 || input.returnQuantity > original.quantity) {
      throw new AppError('VALIDATION_ERROR', 'Invalid exchange quantity');
    }

    const outgoing = await tx.product.findUnique({ where: { id: input.returnProductId } });
    const incoming = await tx.product.findUnique({ where: { id: input.newProductId } });
    if (!outgoing || !incoming) throw new AppError('NOT_FOUND', 'Product not found', 404);
    if (incoming.stockQuantity < input.newQuantity) {
      throw new AppError('INSUFFICIENT_STOCK', 'Replacement product is out of stock');
    }

    const outStock = outgoing.stockQuantity + input.returnQuantity;
    const inStock = incoming.stockQuantity - input.newQuantity;
    const newPrice =
      input.newSellingPrice != null ? Number(input.newSellingPrice) : incoming.sellingPrice;
    if (input.newQuantity <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Replacement quantity must be at least 1');
    }
    if (newPrice < 0) {
      throw new AppError('VALIDATION_ERROR', 'Replacement price is invalid');
    }
    const oldLineValue = roundMoney(original.sellingPrice * input.returnQuantity);
    const newLineValue = roundMoney(newPrice * input.newQuantity);

    await tx.product.update({ where: { id: outgoing.id }, data: { stockQuantity: outStock } });
    await tx.product.update({ where: { id: incoming.id }, data: { stockQuantity: inStock } });

    await tx.inventoryMovement.create({
      data: {
        productId: outgoing.id,
        storeId: sale.storeId,
        userId: input.actorId,
        type: 'EXCHANGE',
        quantity: input.returnQuantity,
        previousStock: outgoing.stockQuantity,
        newStock: outStock,
        sellingPrice: original.sellingPrice,
        reference: sale.invoiceNumber,
        reason: 'Exchange return'
      }
    });
    await tx.inventoryMovement.create({
      data: {
        productId: incoming.id,
        storeId: sale.storeId,
        userId: input.actorId,
        type: 'EXCHANGE',
        quantity: input.newQuantity,
        previousStock: incoming.stockQuantity,
        newStock: inStock,
        sellingPrice: newPrice,
        reference: sale.invoiceNumber,
        reason: 'Exchange replacement'
      }
    });

    const remaining = original.quantity - input.returnQuantity;
    if (remaining <= 0) {
      await tx.saleItem.delete({ where: { id: original.id } });
    } else {
      await tx.saleItem.update({
        where: { id: original.id },
        data: {
          quantity: remaining,
          lineTotal: roundMoney(original.sellingPrice * remaining)
        }
      });
    }

    const existingNew = await tx.saleItem.findFirst({
      where: { saleId: id, productId: incoming.id }
    });
    if (existingNew) {
      const qty = existingNew.quantity + input.newQuantity;
      await tx.saleItem.update({
        where: { id: existingNew.id },
        data: {
          quantity: qty,
          sellingPrice: newPrice,
          lineTotal: roundMoney(newPrice * qty)
        }
      });
    } else {
      await tx.saleItem.create({
        data: {
          saleId: id,
          productId: incoming.id,
          name: incoming.name,
          sku: incoming.sku,
          barcode: incoming.barcode,
          quantity: input.newQuantity,
          sellingPrice: newPrice,
          lineTotal: roundMoney(newPrice * input.newQuantity)
        }
      });
    }

    const items = await tx.saleItem.findMany({ where: { saleId: id } });
    const totals = recalculateTotals(
      items,
      { type: 'fixed', value: sale.discount },
      sale.taxRate,
      sale.deliveryCharge
    );

    const difference = roundMoney(newLineValue - oldLineValue);

    if (difference !== 0 && sale.paymentMethod === 'CASH') {
      await tx.cashTransaction.create({
        data: {
          storeId: sale.storeId,
          userId: input.actorId,
          type: difference > 0 ? 'SALE' : 'REFUND',
          amount: Math.abs(difference),
          reference: sale.invoiceNumber,
          notes: 'Exchange difference'
        }
      });
    }

    const updated = await tx.sale.update({
      where: { id },
      data: {
        status: 'EXCHANGED',
        subtotal: totals.subtotal,
        discount: Math.min(sale.discount, totals.subtotal),
        tax: totals.tax,
        total: totals.total,
        notes: `${sale.notes || ''} | Exchanged ${outgoing.name} → ${incoming.name} (diff ${difference})`.trim()
      },
      include: { items: { include: { product: { select: { size: true } } } }, customer: true, staff: true }
    });

    await writeAudit({
      userId: input.actorId,
      storeId: sale.storeId,
      action: 'STOCK_EXCHANGE',
      entity: 'Sale',
      entityId: sale.id,
      newData: { difference, from: outgoing.sku, to: incoming.sku, invoiceNumber: sale.invoiceNumber }
    });

    return { sale: updated, difference };
  });
}

export async function updateSalePayment(
  id: string,
  input: {
    actorId: string;
    storeId?: string | null;
    paymentStatus?: string;
    paymentMethod?: string;
    amount?: number;
    reason?: string;
  }
) {
  const sale = await prisma.sale.findUnique({ where: { id } });
  if (!sale) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
  if (input.storeId && sale.storeId !== input.storeId) {
    throw new AppError('NOT_FOUND', 'Invoice not found', 404);
  }
  if (sale.status === 'VOID') throw new AppError('VALIDATION_ERROR', 'Cannot update a cancelled sale');
  const extra = roundMoney(Number(input.amount || 0));
  const currentPaid = Number(sale.paidAmount || (sale.paymentStatus === 'PAID' ? sale.total : 0));
  let paid = currentPaid + extra;
  let status = input.paymentStatus || sale.paymentStatus;
  if (extra > 0) {
    if (paid >= sale.total - 0.005) {
      paid = sale.total;
      status = 'PAID';
    } else {
      status = 'PARTIAL';
    }
  }
  const updated = await prisma.sale.update({
    where: { id },
    data: {
      paidAmount: paid,
      paymentStatus: status as never,
      ...(input.paymentMethod ? { paymentMethod: input.paymentMethod as never } : {})
    },
    include: { items: true, customer: true, staff: true }
  });
  if (extra > 0) {
    await postSaleMoney({
      storeId: sale.storeId,
      userId: input.actorId,
      typeKey: 'CUSTOMER_DUE_PAYMENT',
      amount: extra,
      method: input.paymentMethod || String(sale.paymentMethod),
      reference: sale.invoiceNumber,
      notes: input.reason || 'Customer due payment',
      direction: 'IN'
    });
  }
  await recordRevision({
    saleId: id,
    userId: input.actorId,
    action: 'PAYMENT_UPDATE',
    reason: input.reason,
    previousTotal: sale.total,
    updatedTotal: sale.total,
    snapshot: { from: sale.paymentStatus, to: status, paid }
  });
  await writeAudit({
    userId: input.actorId,
    storeId: sale.storeId,
    action: 'SALE_PAYMENT',
    entity: 'Sale',
    entityId: id,
    newData: { status, paid, method: input.paymentMethod }
  });
  return updated;
}

export async function recheckSale(id: string, actorId: string, notes?: string) {
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { items: { include: { product: { select: { size: true, stockQuantity: true } } } }, customer: true, staff: true }
  });
  if (!sale) throw new AppError('NOT_FOUND', 'Invoice not found', 404);
  const updated = await prisma.sale.update({
    where: { id },
    data: { recheckedAt: new Date(), recheckedById: actorId },
    include: { items: true, customer: true, staff: true }
  });
  await recordRevision({
    saleId: id,
    userId: actorId,
    action: 'SALE_RECHECK',
    notes,
    previousTotal: sale.total,
    updatedTotal: sale.total,
    snapshot: {
      items: sale.items,
      discount: sale.discount,
      tax: sale.tax,
      deliveryCharge: sale.deliveryCharge,
      paymentStatus: sale.paymentStatus,
      customer: sale.customer
    }
  });
  await writeAudit({
    userId: actorId,
    storeId: sale.storeId,
    action: 'SALE_RECHECK',
    entity: 'Sale',
    entityId: id
  });
  return { sale: updated, original: sale };
}

export async function listSaleHistory(id: string) {
  return prisma.saleRevision.findMany({
    where: { saleId: id },
    orderBy: { version: 'asc' }
  });
}

function formatItems(items: { productId: string; quantity: number }[]) {
  return items.map((i) => `${i.productId}:${i.quantity}`).join(',');
}
