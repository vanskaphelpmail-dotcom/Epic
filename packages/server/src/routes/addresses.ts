import { Router } from "express";
import { z } from "zod";
import { prisma } from "@jab/db";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

export const addressesRouter = Router();

const addressSchema = z.object({
  label: z.string().optional(),
  fullName: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  addressLine1: z.string().min(3),
  addressLine2: z.string().optional(),
  city: z.string().min(2),
  postalCode: z.string().min(1),
  country: z.string().default("Bangladesh"),
  isDefault: z.boolean().optional(),
});

function mapAddress(row: {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  email: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}) {
  return {
    id: row.id,
    label: row.label || "Home",
    fullName: row.fullName,
    phone: row.phone,
    email: row.email || undefined,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2 || undefined,
    city: row.city,
    postalCode: row.postalCode,
    country: row.country,
    isDefault: row.isDefault,
  };
}

addressesRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const rows = await prisma.address.findMany({
      where: { userId: req.user!.id },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
    return res.json({ success: true, data: { items: rows.map(mapAddress) } });
  } catch (error) {
    console.error("[GET /addresses]", error);
    return res.status(500).json({ success: false, error: { message: "Failed to load addresses" } });
  }
});

addressesRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const body = addressSchema.parse(req.body);
    const created = await prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.address.updateMany({
          where: { userId: req.user!.id },
          data: { isDefault: false },
        });
      }
      const count = await tx.address.count({ where: { userId: req.user!.id } });
      return tx.address.create({
        data: {
          userId: req.user!.id,
          label: body.label,
          fullName: body.fullName,
          phone: body.phone,
          email: body.email,
          addressLine1: body.addressLine1,
          addressLine2: body.addressLine2,
          city: body.city,
          postalCode: body.postalCode,
          country: body.country || "Bangladesh",
          isDefault: body.isDefault ?? count === 0,
        },
      });
    });
    return res.status(201).json({ success: true, data: mapAddress(created) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { message: error.issues[0]?.message || "Invalid address" } });
    }
    console.error("[POST /addresses]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to create address" } });
  }
});

addressesRouter.put("/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const body = addressSchema.partial().parse(req.body);
    const existing = await prisma.address.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: { message: "Address not found" } });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.address.updateMany({
          where: { userId: req.user!.id, NOT: { id: existing.id } },
          data: { isDefault: false },
        });
      }
      return tx.address.update({
        where: { id: existing.id },
        data: {
          ...(body.label != null ? { label: body.label } : {}),
          ...(body.fullName != null ? { fullName: body.fullName } : {}),
          ...(body.phone != null ? { phone: body.phone } : {}),
          ...(body.email != null ? { email: body.email } : {}),
          ...(body.addressLine1 != null ? { addressLine1: body.addressLine1 } : {}),
          ...(body.addressLine2 != null ? { addressLine2: body.addressLine2 } : {}),
          ...(body.city != null ? { city: body.city } : {}),
          ...(body.postalCode != null ? { postalCode: body.postalCode } : {}),
          ...(body.country != null ? { country: body.country } : {}),
          ...(body.isDefault != null ? { isDefault: body.isDefault } : {}),
        },
      });
    });

    return res.json({ success: true, data: mapAddress(updated) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { message: error.issues[0]?.message || "Invalid address" } });
    }
    console.error("[PUT /addresses]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to update address" } });
  }
});

addressesRouter.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const existing = await prisma.address.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: { message: "Address not found" } });
    }
    await prisma.address.delete({ where: { id: existing.id } });
    if (existing.isDefault) {
      const next = await prisma.address.findFirst({
        where: { userId: req.user!.id },
        orderBy: { updatedAt: "desc" },
      });
      if (next) {
        await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }
    return res.json({ success: true, data: { id: existing.id } });
  } catch (error) {
    console.error("[DELETE /addresses]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to delete address" } });
  }
});
