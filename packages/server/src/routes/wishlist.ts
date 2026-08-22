import { Router } from "express";
import { z } from "zod";
import { prisma } from "@jab/db";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { toSpaProduct } from "../mappers/product";

export const wishlistRouter = Router();

wishlistRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const rows = await prisma.wishlistItem.findMany({
      where: { userId: req.user!.id },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    });
    return res.json({
      success: true,
      data: {
        items: rows
          .filter((r) => r.product && !r.product.deletedAt)
          .map((r) => toSpaProduct(r.product!)),
      },
    });
  } catch (error) {
    console.error("[GET /wishlist]", error);
    return res.status(500).json({ success: false, error: { message: "Failed to load wishlist" } });
  }
});

wishlistRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const productId = z.string().min(1).parse(req.body.productId);
    const product = await prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
    });
    if (!product) {
      return res.status(404).json({ success: false, error: { message: "Product not found" } });
    }

    await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: req.user!.id, productId } },
      create: { userId: req.user!.id, productId },
      update: {},
    });

    return res.status(201).json({ success: true, data: { product: toSpaProduct(product) } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { message: "productId required" } });
    }
    console.error("[POST /wishlist]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to add wishlist item" } });
  }
});

wishlistRouter.delete("/:productId", requireAuth, async (req: AuthedRequest, res) => {
  try {
    await prisma.wishlistItem.deleteMany({
      where: { userId: req.user!.id, productId: req.params.productId },
    });
    return res.json({ success: true, data: { productId: req.params.productId } });
  } catch (error) {
    console.error("[DELETE /wishlist]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to remove wishlist item" } });
  }
});
