import { Router } from "express";
import { z } from "zod";
import { prisma } from "@jab/db";
import { requireAuth, requireStaff, optionalAuth, isStaffUser, type AuthedRequest } from "../middleware/auth";
import { requirePermission } from "../lib/permissions";

export const reviewsRouter = Router();

reviewsRouter.get("/", optionalAuth, async (req: AuthedRequest, res) => {
  try {
    const productId = req.query.productId ? String(req.query.productId) : undefined;
    const wantsAll = req.query.all === "1";
    if (wantsAll && !isStaffUser(req.user)) {
      return res.status(403).json({
        success: false,
        error: { message: "Staff access required for unapproved reviews" },
      });
    }
    const all = wantsAll && isStaffUser(req.user);
    const rows = await prisma.review.findMany({
      where: {
        ...(productId ? { productId } : {}),
        ...(all ? {} : { approved: true }),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return res.json({
      success: true,
      data: {
        items: rows.map((r) => ({
          id: r.id,
          productId: r.productId,
          userId: r.userId,
          userName: r.userName,
          rating: r.rating,
          comment: r.comment,
          verified: r.verified,
          approved: r.approved,
          createdAt: r.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("[GET /reviews]", error);
    return res.status(500).json({ success: false, error: { message: "Failed to list reviews" } });
  }
});

reviewsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const body = z
      .object({
        productId: z.string().min(1),
        rating: z.number().int().min(1).max(5),
        comment: z.string().min(3).max(2000),
      })
      .parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(401).json({ success: false, error: { message: "Unauthorized" } });
    }

    const product = await prisma.product.findFirst({
      where: { id: body.productId, deletedAt: null },
    });
    if (!product) {
      return res.status(404).json({ success: false, error: { message: "Product not found" } });
    }

    const created = await prisma.review.create({
      data: {
        productId: body.productId,
        userId: user.id,
        userName: user.fullName,
        rating: body.rating,
        comment: body.comment.trim(),
        verified: true,
        approved: true,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        id: created.id,
        productId: created.productId,
        userName: created.userName,
        rating: created.rating,
        comment: created.comment,
        approved: created.approved,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { message: error.issues[0]?.message || "Invalid review" } });
    }
    console.error("[POST /reviews]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to create review" } });
  }
});

reviewsRouter.patch("/:id/approve", requirePermission("can_manage_reviews"), async (req: AuthedRequest, res) => {
  try {
    const approved = Boolean(req.body.approved ?? true);
    const updated = await prisma.review.update({
      where: { id: req.params.id },
      data: { approved },
    });
    return res.json({ success: true, data: { id: updated.id, approved: updated.approved } });
  } catch (error) {
    console.error("[PATCH /reviews/:id/approve]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to update review" } });
  }
});

reviewsRouter.delete("/:id", requirePermission("can_manage_reviews"), async (req: AuthedRequest, res) => {
  try {
    await prisma.review.delete({ where: { id: req.params.id } });
    return res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error("[DELETE /reviews]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to delete review" } });
  }
});
