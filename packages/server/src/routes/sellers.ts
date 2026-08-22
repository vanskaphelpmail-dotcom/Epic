import { Router } from "express";
import { prisma } from "@jab/db";
import { requireStaff, type AuthedRequest } from "../middleware/auth";
import { requirePermission, requireAnyPermission } from "../lib/permissions";

export const sellersRouter = Router();

sellersRouter.get("/", requirePermission("can_manage_seller_desk"), async (_req, res) => {
  try {
    const items = await prisma.sellerRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return res.json({
      success: true,
      data: {
        items: items.map((r) => ({
          id: r.id,
          shirtName: r.shirtName,
          brand: r.brand,
          season: r.season,
          condition: r.condition,
          expectedPrice: Number(r.expectedPrice),
          imageUrls: r.imageUrls,
          status: r.status,
          adminNote: r.adminNote,
          createdAt: r.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("[GET /sellers]", error);
    return res.status(500).json({ success: false, error: { message: "Failed to list seller requests" } });
  }
});

sellersRouter.patch("/:id", requirePermission("can_manage_seller_desk"), async (req: AuthedRequest, res) => {
  try {
    const status = String(req.body.status || "").toUpperCase();
    const updated = await prisma.sellerRequest.update({
      where: { id: req.params.id },
      data: {
        ...(status ? { status: status as never } : {}),
        ...(req.body.adminNote != null ? { adminNote: String(req.body.adminNote) } : {}),
      },
    });
    return res.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        adminNote: updated.adminNote,
      },
    });
  } catch (error) {
    console.error("[PATCH /sellers/:id]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to update seller request" } });
  }
});
