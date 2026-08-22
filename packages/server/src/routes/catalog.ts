import { Router } from "express";
import { z } from "zod";
import { prisma } from "@jab/db";
import { requireStaff, type AuthedRequest } from "../middleware/auth";
import { requirePermission } from "../lib/permissions";

export const catalogRouter = Router();

catalogRouter.get("/brands", async (_req, res) => {
  try {
    const rows = await prisma.brand.findMany({ orderBy: { name: "asc" } });
    return res.json({ success: true, data: { items: rows } });
  } catch (error) {
    console.error("[GET /catalog/brands]", error);
    return res.status(500).json({ success: false, error: { message: "Failed to list brands" } });
  }
});

catalogRouter.post("/brands", requirePermission("can_manage_products"), async (req: AuthedRequest, res) => {
  try {
    const name = z.string().min(1).parse(req.body.name).trim();
    const created = await prisma.brand.upsert({
      where: { name },
      create: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") },
      update: {},
    });
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { message: "Brand name required" } });
    }
    console.error("[POST /catalog/brands]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to create brand" } });
  }
});

catalogRouter.get("/leagues", async (_req, res) => {
  try {
    const rows = await prisma.league.findMany({
      orderBy: { name: "asc" },
      include: { category: true },
    });
    return res.json({ success: true, data: { items: rows } });
  } catch (error) {
    console.error("[GET /catalog/leagues]", error);
    return res.status(500).json({ success: false, error: { message: "Failed to list leagues" } });
  }
});

catalogRouter.post("/leagues", requirePermission("can_manage_products"), async (req: AuthedRequest, res) => {
  try {
    const body = z
      .object({
        name: z.string().min(1),
        slug: z.string().optional(),
        mark: z.string().optional(),
        logoUrl: z.string().optional(),
      })
      .parse(req.body);
    const slug = (body.slug || body.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const created = await prisma.league.upsert({
      where: { slug },
      create: {
        name: body.name.trim(),
        slug,
        mark: body.mark,
        logoUrl: body.logoUrl,
      },
      update: {
        name: body.name.trim(),
        ...(body.mark != null ? { mark: body.mark } : {}),
        ...(body.logoUrl != null ? { logoUrl: body.logoUrl } : {}),
      },
    });
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { message: error.issues[0]?.message || "Invalid league" } });
    }
    console.error("[POST /catalog/leagues]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to create league" } });
  }
});

catalogRouter.get("/categories", async (_req, res) => {
  try {
    const rows = await prisma.category.findMany({
      orderBy: { rowOrder: "asc" },
      include: { children: true },
    });
    return res.json({ success: true, data: { items: rows } });
  } catch (error) {
    console.error("[GET /catalog/categories]", error);
    return res.status(500).json({ success: false, error: { message: "Failed to list categories" } });
  }
});

catalogRouter.post("/categories", requirePermission("can_manage_products"), async (req: AuthedRequest, res) => {
  try {
    const body = z
      .object({
        name: z.string().min(1),
        slug: z.string().optional(),
        parentId: z.string().optional(),
        icon: z.string().optional(),
      })
      .parse(req.body);
    const slug = (body.slug || body.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const created = await prisma.category.upsert({
      where: { slug },
      create: {
        name: body.name.trim(),
        slug,
        parentId: body.parentId,
        icon: body.icon,
      },
      update: {
        name: body.name.trim(),
        ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
        ...(body.icon != null ? { icon: body.icon } : {}),
      },
    });
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { message: error.issues[0]?.message || "Invalid category" } });
    }
    console.error("[POST /catalog/categories]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to create category" } });
  }
});
