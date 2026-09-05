/**
 * One-time staff bootstrap for production when local DATABASE_URL ≠ Vercel Neon.
 * Gated by ALLOW_ADMIN_BOOTSTRAP=1 + x-bootstrap-secret header.
 * Disable immediately after use.
 */
import { Router } from "express";
import { z } from "zod";
import { hash } from "bcryptjs";
import { prisma } from "@jab/db";

export const bootstrapRouter = Router();

const STAFF = [
  { email: "admin@epicvanskap.com", fullName: "Epic Vanskap Admin", role: "SUPER_ADMIN" as const },
  { email: "hasanrahinn@gmail.com", fullName: "Rahin", role: "ADMIN" as const },
  { email: "yaqubislam71@gmail.com", fullName: "Yaqub", role: "ADMIN" as const },
  { email: "epicvanskap@gmail.com", fullName: "Vanskap", role: "ADMIN" as const },
];

bootstrapRouter.post("/bootstrap-staff", async (req, res) => {
  if (process.env.ALLOW_ADMIN_BOOTSTRAP !== "1") {
    return res.status(404).json({ success: false, error: { message: "Not found" } });
  }

  const expected = (process.env.BOOTSTRAP_SECRET || "").trim();
  const provided = String(req.headers["x-bootstrap-secret"] || "").trim();
  if (!expected || provided !== expected) {
    return res.status(401).json({ success: false, error: { message: "Unauthorized" } });
  }

  try {
    const body = z
      .object({
        password: z.string().min(8).max(128),
      })
      .parse(req.body);

    const passwordHash = await hash(body.password, 12);
    const upserted: string[] = [];

    for (const admin of STAFF) {
      const email = admin.email.toLowerCase();
      await prisma.user.upsert({
        where: { email },
        update: {
          passwordHash,
          role: admin.role,
          status: "ACTIVE",
          permissions: ["*"],
          fullName: admin.fullName,
          department: "Operations",
        },
        create: {
          email,
          fullName: admin.fullName,
          passwordHash,
          role: admin.role,
          permissions: ["*"],
          status: "ACTIVE",
          department: "Operations",
        },
      });
      upserted.push(email);
    }

    return res.json({
      success: true,
      data: {
        message: "Staff accounts upserted. Remove ALLOW_ADMIN_BOOTSTRAP from Vercel now.",
        upserted,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { message: error.issues[0]?.message || "Invalid input" },
      });
    }
    console.error("[auth/bootstrap-staff]", error);
    return res.status(500).json({ success: false, error: { message: "Bootstrap failed" } });
  }
});
