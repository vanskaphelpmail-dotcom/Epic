import { Router } from "express";
import { z } from "zod";
import { prisma } from "@jab/db";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

export const cartRouter = Router();

cartRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const cart = await prisma.cart.findUnique({
      where: { userId: req.user!.id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
    return res.json({
      success: true,
      data: {
        items: (cart?.items || []).map((item) => ({
          id: item.id,
          productId: item.productId,
          selectedSize: item.selectedSize,
          quantity: item.quantity,
          customPrintName: item.customPrintName,
          customPrintNum: item.customPrintNum,
          addBadge: item.addBadge,
          selectedBadgeIds: item.selectedBadgeIds,
          product: item.product
            ? {
                id: item.product.id,
                name: item.product.name,
                slug: item.product.slug,
                sku: item.product.sku,
                price: Number(item.product.price),
                image: item.product.imageUrl,
                stock: item.product.stock,
                sizes: item.product.sizes,
              }
            : null,
        })),
      },
    });
  } catch (error) {
    console.error("[GET /cart]", error);
    return res.status(500).json({ success: false, error: { message: "Failed to load cart" } });
  }
});

const syncSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string(),
      selectedSize: z.string().default("M"),
      quantity: z.number().int().positive(),
      customPrintName: z.string().optional().nullable(),
      customPrintNum: z.number().optional().nullable(),
      addBadge: z.boolean().optional(),
      selectedBadgeIds: z.string().optional().nullable(),
    }),
  ),
});

cartRouter.put("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const body = syncSchema.parse(req.body);
    const productIds = [...new Set(body.items.map((i) => i.productId))];
    const products = productIds.length
      ? await prisma.product.findMany({ where: { id: { in: productIds }, deletedAt: null } })
      : [];
    const priceById = new Map(products.map((p) => [p.id, Number(p.price)]));

    for (const item of body.items) {
      if (!priceById.has(item.productId)) {
        return res.status(400).json({
          success: false,
          error: { message: `Product unavailable: ${item.productId}` },
        });
      }
    }

    const cart = await prisma.cart.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id },
      update: {},
    });

    await prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      if (body.items.length) {
        await tx.cartItem.createMany({
          data: body.items.map((item) => ({
            cartId: cart.id,
            productId: item.productId,
            selectedSize: item.selectedSize || "M",
            quantity: item.quantity,
            customPrintName: item.customPrintName || "",
            customPrintNum: item.customPrintNum ?? 0,
            addBadge: item.addBadge ?? false,
            selectedBadgeIds: item.selectedBadgeIds || "",
            unitPrice: priceById.get(item.productId)!,
          })),
        });
      }
    });

    return res.json({ success: true, data: { synced: body.items.length } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { message: error.issues[0]?.message || "Invalid cart" } });
    }
    console.error("[PUT /cart]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to sync cart" } });
  }
});

cartRouter.delete("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const cart = await prisma.cart.findUnique({ where: { userId: req.user!.id } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    return res.json({ success: true, data: { cleared: true } });
  } catch (error) {
    console.error("[DELETE /cart]", error);
    return res.status(500).json({ success: false, error: { message: "Failed to clear cart" } });
  }
});
