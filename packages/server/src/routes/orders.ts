import { Router } from "express";
import { z } from "zod";
import { prisma } from "@jab/db";
import type { Product as DbProduct } from "@jab/db";
import { optionalAuth, requireAuth, requireStaff, type AuthedRequest } from "../middleware/auth";
import { requireAnyPermission, requirePermission } from "../lib/permissions";

export const ordersRouter = Router();

function lineUnitPrice(
  product: DbProduct,
  item: {
    customPrintName?: string;
    customPrintNum?: number;
    selectedBadgeIds?: string;
  },
  globalPatches?: unknown,
): number {
  let unit = Number(product.price);
  const hasNameset = Boolean(
    (item.customPrintName && item.customPrintName.trim()) ||
      (item.customPrintNum != null && item.customPrintNum > 0),
  );
  if (hasNameset && product.printAvailable) {
    unit += Number(product.namesetPriceBdt ?? 15);
  }

  const badgeIds = (item.selectedBadgeIds || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (badgeIds.length && product.badgeAvailable) {
    const raw =
      (Array.isArray(globalPatches) && globalPatches.length > 0
        ? globalPatches
        : product.badgeOptions) || [];
    if (Array.isArray(raw) && raw.length > 0) {
      for (const badgeId of badgeIds) {
        const match = raw.find(
          (entry) =>
            entry &&
            typeof entry === "object" &&
            String((entry as { id?: string }).id || "") === badgeId,
        ) as { priceBdt?: number } | undefined;
        unit += Math.max(0, Number(match?.priceBdt ?? 0));
      }
    } else {
      unit += Number(product.badgePriceBdt ?? 15) * badgeIds.length;
    }
  }

  return unit;
}

const createOrderSchema = z.object({
  paymentMethod: z
    .enum(["bkash", "nagad", "cod", "bKash", "Nagad", "CASH ON DELIVERY"])
    .transform((v) => {
      const lower = v.toLowerCase();
      if (lower.includes("nagad")) return "nagad";
      if (lower.includes("bkash")) return "bkash";
      return "cod";
    }),
  deliveryRegion: z.enum(["inside", "outside"]),
  deliveryCharge: z.number().nonnegative(),
  shipFullName: z.string().min(2),
  shipPhone: z.string().min(8),
  shipEmail: z.string().email().optional(),
  shipAddressLine1: z.string().min(3),
  shipAddressLine2: z.string().optional(),
  shipCity: z.string().min(2),
  shipPostalCode: z.string().optional(),
  bkashNumber: z.string().optional(),
  bkashTransactionId: z.string().optional(),
  /** Customer choice when admin allows both; server still validates against store settings */
  bkashPaymentType: z.enum(["full", "partial"]).optional(),
  customerNotes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        selectedSize: z.string(),
        quantity: z.number().int().positive(),
        customPrintName: z.string().optional(),
        customPrintNum: z.number().optional(),
        namesetEnabled: z.boolean().optional(),
        addBadge: z.boolean().optional(),
        selectedBadgeIds: z.string().optional(),
      }),
    )
    .min(1),
});

ordersRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const isStaff = ["SUPER_ADMIN", "ADMIN", "ORDER_MANAGER", "CUSTOMER_SUPPORT"].includes(
      req.user!.role,
    );
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.trunc(limitRaw), 1), isStaff ? 100 : 50)
      : isStaff
        ? 50
        : 30;

    // Lean list: line items already store name/sku/image — skip nested product + timeline
    const orders = await prisma.order.findMany({
      where: isStaff ? undefined : { customerId: req.user!.id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        deliveryRegion: true,
        deliveryCharge: true,
        subtotal: true,
        tax: true,
        shipping: true,
        total: true,
        shipFullName: true,
        shipPhone: true,
        shipEmail: true,
        shipAddressLine1: true,
        shipAddressLine2: true,
        shipCity: true,
        shipPostalCode: true,
        shipCountry: true,
        trackingNumber: true,
        carrier: true,
        trackingUrl: true,
        shippedAt: true,
        bkashNumber: true,
        bkashTransactionId: true,
        customerNotes: true,
        internalNotes: true,
        createdAt: true,
        updatedAt: true,
        customerId: true,
        payments: {
          select: {
            amount: true,
            status: true,
            rawPayload: true,
            provider: true,
          },
          take: 3,
        },
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            productSku: true,
            productImageUrl: true,
            selectedSize: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            customPrintName: true,
            customPrintNum: true,
            addBadge: true,
            selectedBadgeIds: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return res.json({ success: true, data: { items: orders } });
  } catch (error) {
    console.error("[GET /orders]", error);
    return res.status(500).json({ success: false, error: { message: "Failed to list orders" } });
  }
});

ordersRouter.post("/", optionalAuth, async (req: AuthedRequest, res) => {
  try {
    const body = createOrderSchema.parse(req.body);

    if (body.paymentMethod === "bkash" || body.paymentMethod === "nagad") {
      if (!body.bkashNumber || !body.bkashTransactionId) {
        return res.status(400).json({
          success: false,
          error: {
            message:
              body.paymentMethod === "nagad"
                ? "Nagad number and Transaction ID are required"
                : "bKash number and Transaction ID are required",
          },
        });
      }
    }

    const productIds = [...new Set(body.items.map((i) => i.productId))];

    // Pre-fetch outside the interactive transaction to avoid Neon round-trip timeouts.
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, deletedAt: null, status: "ACTIVE" },
    });
    const storeSettings = await prisma.storeSettings.findUnique({ where: { id: "default" } });
    const globalPatches = (storeSettings as { tournamentPatches?: unknown } | null)?.tournamentPatches;
    const byId = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    const lineCreates: Array<{
      productId: string;
      productName: string;
      productSku: string;
      productImageUrl: string | null;
      selectedSize: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      customPrintName?: string;
      customPrintNum?: number;
      addBadge: boolean;
      selectedBadgeIds: string;
    }> = [];
    const stockPlans: Array<{
      productId: string;
      productName: string;
      sku: string;
      previousStock: number;
      quantity: number;
      nextStock: number;
    }> = [];

    for (const item of body.items) {
      const product = byId.get(item.productId);
      if (!product) {
        return res.status(400).json({
          success: false,
          error: { message: `Product unavailable: ${item.productId}` },
        });
      }
      const planned = stockPlans.find((s) => s.productId === product.id);
      const reserved = planned?.quantity ?? 0;
      const isPreOrder = Boolean((product as { isPreOrder?: boolean }).isPreOrder);
      if (!isPreOrder && product.stock - reserved < item.quantity) {
        return res.status(400).json({
          success: false,
          error: { message: `Insufficient stock for ${product.sku}` },
        });
      }

      const unit = lineUnitPrice(product, item, globalPatches);
      const lineTotal = unit * item.quantity;
      subtotal += lineTotal;
      lineCreates.push({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        productImageUrl: product.imageUrl,
        selectedSize: item.selectedSize,
        quantity: item.quantity,
        unitPrice: unit,
        lineTotal,
        customPrintName: item.customPrintName,
        customPrintNum: item.customPrintNum,
        addBadge: item.addBadge ?? false,
        selectedBadgeIds: item.selectedBadgeIds || "",
      });

      if (!isPreOrder) {
        if (planned) {
          planned.quantity += item.quantity;
          planned.nextStock = planned.previousStock - planned.quantity;
        } else {
          stockPlans.push({
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            previousStock: product.stock,
            quantity: item.quantity,
            nextStock: product.stock - item.quantity,
          });
        }
      }
    }

    const settings = await prisma.storeSettings.findUnique({ where: { id: "default" } });
    const insideFee = Number(settings?.deliveryInside ?? 0) || 70;
    const outsideFee = Number(settings?.deliveryOutside ?? 0) || 130;
    const deliveryCharge =
      body.deliveryRegion === "inside" ? insideFee : outsideFee;
    const total = subtotal + deliveryCharge;
    const orderNumber = `JAB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(
      Math.random() * 9000 + 1000,
    )}`;

    // Customer chooses full or partial; nameset always forces full.
    // Partial advance = ৳perJersey × jersey qty (1→300, 2→600, 3→900…).
    const partialPerJerseyBdt = Math.max(1, Number(settings?.bkashPartialAmountBdt) || 300);
    const jerseyCount = body.items.reduce(
      (sum, item) => sum + Math.max(0, Math.floor(Number(item.quantity) || 0)),
      0,
    );
    const partialAdvanceBdt = Math.min(partialPerJerseyBdt * jerseyCount, total);
    const orderHasNameset = body.items.some((item) => {
      if (item.namesetEnabled) return true;
      if (item.customPrintName && item.customPrintName.trim()) return true;
      return item.customPrintNum != null && Number(item.customPrintNum) > 0;
    });
    const isMobileWallet =
      body.paymentMethod === "bkash" || body.paymentMethod === "nagad";
    const walletLabel = body.paymentMethod === "nagad" ? "Nagad" : "bKash";
    let bkashPaymentType: "full" | "partial" =
      body.bkashPaymentType === "partial" ? "partial" : "full";
    // Custom jersey name / nameset → full payment only
    if (orderHasNameset && isMobileWallet) {
      bkashPaymentType = "full";
    }
    const bkashPaidAmount = isMobileWallet
      ? bkashPaymentType === "partial"
        ? Math.min(partialAdvanceBdt, total)
        : total
      : 0;
    const dueOnDelivery =
      isMobileWallet && bkashPaymentType === "partial"
        ? Math.max(0, total - bkashPaidAmount)
        : 0;
    const bkashNoteTag = `[${walletLabel.toUpperCase()}:${bkashPaymentType}:paid=${Math.round(bkashPaidAmount)}:total=${Math.round(total)}]`;
    const bkashHumanNote =
      bkashPaymentType === "partial"
        ? `${walletLabel.toUpperCase()}_PARTIAL: send ৳${Math.round(bkashPaidAmount)} now (৳${partialPerJerseyBdt}×${jerseyCount} jerseys); ৳${Math.round(dueOnDelivery)} due on delivery (order ৳${Math.round(total)})`
        : `${walletLabel.toUpperCase()}_FULL: send ৳${Math.round(bkashPaidAmount)}`;
    const mergedCustomerNotes = isMobileWallet
      ? [bkashNoteTag, bkashHumanNote, body.customerNotes?.trim()]
          .filter(Boolean)
          .join(" | ")
      : body.customerNotes || undefined;

    const order = await prisma.$transaction(
      async (tx) => {
        for (const plan of stockPlans) {
          const updated = await tx.product.updateMany({
            where: { id: plan.productId, stock: { gte: plan.quantity }, deletedAt: null },
            data: { stock: { decrement: plan.quantity } },
          });
          if (updated.count !== 1) {
            throw new Error(`Insufficient stock for ${plan.sku}`);
          }
        }

        if (stockPlans.length) {
          await tx.stockLog.createMany({
            data: stockPlans.map((plan) => ({
              productId: plan.productId,
              productName: plan.productName,
              sku: plan.sku,
              previousStock: plan.previousStock,
              newStock: plan.nextStock,
              change: -plan.quantity,
              reason: "SALE" as const,
              userId: req.user?.id ?? null,
            })),
          });
        }

        // Guest checkout allowed; Send Money with TrxID auto-confirms the order (staff still verify payment).
        const isMobileWalletPay = isMobileWallet;
        const walletFieldsDone = Boolean(
          isMobileWalletPay && body.bkashNumber?.trim() && body.bkashTransactionId?.trim(),
        );
        const orderStatus = walletFieldsDone ? "CONFIRMED" : isMobileWalletPay ? "PENDING" : "PROCESSING";
        return tx.order.create({
          data: {
            orderNumber,
            customerId: req.user?.id ?? null,
            guestEmail: req.user?.id ? undefined : body.shipEmail || null,
            paymentMethod: isMobileWalletPay ? walletLabel : "CASH ON DELIVERY",
            paymentStatus: "UNPAID",
            bkashNumber: body.bkashNumber,
            bkashTransactionId: body.bkashTransactionId,
            deliveryRegion: body.deliveryRegion === "inside" ? "INSIDE" : "OUTSIDE",
            deliveryCharge,
            subtotal,
            shipping: deliveryCharge,
            total,
            currencyCode: "BDT",
            shipFullName: body.shipFullName,
            shipPhone: body.shipPhone,
            shipEmail: body.shipEmail,
            shipAddressLine1: body.shipAddressLine1,
            shipAddressLine2: body.shipAddressLine2,
            shipCity: body.shipCity,
            shipPostalCode: body.shipPostalCode || "N/A",
            status: orderStatus,
            customerNotes: mergedCustomerNotes,
            items: { create: lineCreates },
            timeline: {
              create: {
                status: orderStatus,
                note: isMobileWalletPay
                  ? bkashPaymentType === "partial"
                    ? `Order placed (guest ok) — ${walletLabel} PARTIAL advance ৳${Math.round(bkashPaidAmount)} (৳${partialPerJerseyBdt}×${jerseyCount}); ৳${Math.round(dueOnDelivery)} due on delivery — awaiting staff payment verification`
                    : `Order placed (guest ok) — ${walletLabel} FULL ৳${Math.round(bkashPaidAmount)} (TrxID submitted), order confirmed — awaiting staff payment verification`
                  : "Order placed (COD)",
                updatedById: req.user?.id ?? null,
              },
            },
            payments: isMobileWalletPay
              ? {
                  create: {
                    provider: body.paymentMethod === "nagad" ? "nagad" : "bkash",
                    providerRef: body.bkashTransactionId,
                    amount: bkashPaidAmount,
                    status: "UNPAID",
                    rawPayload: {
                      walletNumber: body.bkashNumber,
                      awaitingVerification: true,
                      paymentType: bkashPaymentType,
                      paidAmount: bkashPaidAmount,
                      orderTotal: total,
                      dueOnDelivery,
                      jerseyCount,
                      partialPerJerseyBdt,
                      wallet: body.paymentMethod,
                    },
                  },
                }
              : undefined,
          },
          include: { items: true, timeline: true, payments: true },
        });
      },
      { maxWait: 20_000, timeout: 60_000 },
    );

    return res.status(201).json({ success: true, data: order });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { message: error.issues[0]?.message || "Invalid order" } });
    }
    console.error("[POST /orders]", error);
    return res.status(400).json({
      success: false,
      error: { message: error instanceof Error ? error.message : "Failed to create order" },
    });
  }
});

ordersRouter.patch(
  "/:id/status",
  requireAnyPermission("can_manage_orders", "can_delete_orders", "can_process_refunds"),
  async (req: AuthedRequest, res) => {
  try {
    const status = String(req.body.status || "").toUpperCase().replace(/\s+/g, "_");
    const { loadUserAccessFlags, hasAnyPermission } = await import("../lib/permissions");
    if (["CANCELLED", "REFUNDED", "REFUND_REQUEST", "RETURNED"].includes(status)) {
      const loaded = await loadUserAccessFlags(req.user!.id);
      const flags = loaded?.flags;
      const isRoot =
        req.user!.role === "SUPER_ADMIN" || (req.user!.permissions || []).includes("*");
      if (
        !isRoot &&
        flags &&
        !hasAnyPermission(flags, ["can_delete_orders", "can_process_refunds"])
      ) {
        return res.status(403).json({
          success: false,
          error: { message: "Missing permission to cancel/refund orders" },
        });
      }
    }
    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status: status as never,
        timeline: {
          create: {
            status,
            note: req.body.note || `Status → ${status}`,
            updatedById: req.user!.id,
          },
        },
      },
      include: { timeline: true, items: true },
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PATCH /orders/:id/status]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to update order" } });
  }
});

ordersRouter.patch(
  "/:id/logistics",
  requireAnyPermission("can_manage_orders", "can_delete_orders"),
  async (req: AuthedRequest, res) => {
  try {
    const {
      carrier,
      trackingNumber,
      trackingUrl,
      shippedAt,
      estimatedDelivery,
      internalNotes,
      customerNotes,
    } = req.body || {};

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        ...(carrier != null ? { carrier: String(carrier) } : {}),
        ...(trackingNumber != null ? { trackingNumber: String(trackingNumber) } : {}),
        ...(trackingUrl != null ? { trackingUrl: String(trackingUrl) } : {}),
        ...(shippedAt != null ? { shippedAt: new Date(shippedAt) } : {}),
        ...(estimatedDelivery != null
          ? { estimatedDelivery: new Date(estimatedDelivery) }
          : {}),
        ...(internalNotes != null ? { internalNotes: String(internalNotes) } : {}),
        ...(customerNotes != null ? { customerNotes: String(customerNotes) } : {}),
        timeline: {
          create: {
            status: "LOGISTICS_UPDATED",
            note:
              req.body.note ||
              `Logistics updated${carrier ? `: ${carrier}` : ""}${
                trackingNumber ? ` #${trackingNumber}` : ""
              }`,
            updatedById: req.user!.id,
          },
        },
      },
      include: { timeline: true, items: true },
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PATCH /orders/:id/logistics]", error);
    return res.status(400).json({
      success: false,
      error: { message: "Failed to update order logistics" },
    });
  }
});
