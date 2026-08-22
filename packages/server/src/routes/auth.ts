import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { compare, hash } from "bcryptjs";
import { prisma } from "@jab/db";
import {
  mapRoleToUi,
  mapUiRoleToPrisma,
  requireAuth,
  signToken,
  type AuthedRequest,
} from "../middleware/auth";
import { resolveAccessFlags } from "../lib/permissions";

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

authRouter.post("/register", async (_req, res) => {
  return res.status(403).json({
    success: false,
    error: { message: "Public registration is disabled. Admin accounts only." },
  });
});

authRouter.post("/login", async (req, res) => {
  try {
    const body = credentialsSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== "ACTIVE") {
      return res.status(401).json({ success: false, error: { message: "Invalid email or password" } });
    }

    const ok = await compare(body.password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ success: false, error: { message: "Invalid email or password" } });
    }

    // Storefront customer login disabled — staff/admin only
    if (user.role === "CUSTOMER") {
      return res.status(403).json({
        success: false,
        error: { message: "Only admin accounts can sign in. Customer login is disabled." },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const authUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      permissions: user.permissions,
    };
    const token = signToken(authUser);

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: mapRoleToUi(user.role),
          phone: user.phone ?? undefined,
          permissions: user.permissions,
          accessFlags: resolveAccessFlags(
            user.role,
            (user.accessFlags as Record<string, boolean> | null) || null,
            user.permissions || [],
          ),
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { message: error.issues[0]?.message || "Invalid input" } });
    }
    console.error("[auth/login]", error);
    return res.status(500).json({ success: false, error: { message: "Login failed" } });
  }
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ success: false, error: { message: "User not found" } });
  if (user.status !== "ACTIVE") {
    return res.status(403).json({ success: false, error: { message: "Account inactive" } });
  }
  return res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: mapRoleToUi(user.role),
      phone: user.phone ?? undefined,
      permissions: user.permissions,
      accessFlags: resolveAccessFlags(
        user.role,
        (user.accessFlags as Record<string, boolean> | null) || null,
        user.permissions || [],
      ),
    },
  });
});

authRouter.patch("/me", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const body = z
      .object({
        fullName: z.string().min(2).optional(),
        phone: z.string().min(8).optional(),
      })
      .parse(req.body);

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(body.fullName != null ? { fullName: body.fullName.trim() } : {}),
        ...(body.phone != null ? { phone: body.phone.trim() } : {}),
      },
    });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        role: mapRoleToUi(updated.role),
        phone: updated.phone ?? undefined,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { message: error.issues[0]?.message || "Invalid profile" } });
    }
    console.error("[auth/me PATCH]", error);
    return res.status(400).json({ success: false, error: { message: "Profile update failed" } });
  }
});

authRouter.post("/forgot-password", async (req, res) => {
  try {
    const email = z.string().email().parse(req.body.email).toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success to avoid email enumeration
    if (user) {
      const token = randomUUID().replace(/-/g, "");
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: token,
          resetTokenExpires: new Date(Date.now() + 1000 * 60 * 30),
        },
      });
      // Production: send email. Dev: return token for testing only.
      const payload: Record<string, unknown> = {
        message: "If that email exists, a reset link was issued.",
      };
      if (process.env.NODE_ENV !== "production") {
        payload.devResetToken = token;
      }
      return res.json({ success: true, data: payload });
    }
    return res.json({
      success: true,
      data: { message: "If that email exists, a reset link was issued." },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { message: "Valid email required" } });
    }
    console.error("[auth/forgot-password]", error);
    return res.status(500).json({ success: false, error: { message: "Request failed" } });
  }
});

authRouter.post("/reset-password", async (req, res) => {
  try {
    const body = z
      .object({
        token: z.string().min(20),
        password: z.string().min(6),
      })
      .parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        resetToken: body.token,
        resetTokenExpires: { gt: new Date() },
      },
    });
    if (!user) {
      return res.status(400).json({ success: false, error: { message: "Invalid or expired reset token" } });
    }

    const passwordHash = await hash(body.password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    return res.json({ success: true, data: { message: "Password updated. You can sign in now." } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { message: error.issues[0]?.message || "Invalid input" } });
    }
    console.error("[auth/reset-password]", error);
    return res.status(500).json({ success: false, error: { message: "Reset failed" } });
  }
});

// silence unused import warning in some tooling
void mapUiRoleToPrisma;
