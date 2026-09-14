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

authRouter.post("/register", async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      fullName: z.string().min(2).max(120),
      phone: z.string().min(8).max(30),
      address: z.string().min(3).max(500),
      city: z.string().min(2).max(80).optional(),
    });
    const body = schema.parse(req.body);
    const email = body.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { message: "An account with this email already exists. Please sign in." },
      });
    }

    const phone = body.phone.trim();
    const addressLine1 = body.address.trim();
    const city = (body.city?.trim() || "Feni").slice(0, 80);
    const passwordHash = await hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: body.fullName.trim(),
        phone,
        role: "CUSTOMER",
        status: "ACTIVE",
        permissions: [],
        addresses: {
          create: {
            label: "Home",
            fullName: body.fullName.trim(),
            phone,
            email,
            addressLine1,
            city,
            postalCode: "N/A",
            country: "Bangladesh",
            isDefault: true,
          },
        },
      },
    });

    const authUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      permissions: user.permissions,
    };
    const token = signToken(authUser);

    return res.status(201).json({
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
      return res.status(400).json({
        success: false,
        error: { message: error.issues[0]?.message || "Invalid input" },
      });
    }
    console.error("[auth/register]", error);
    return res.status(500).json({ success: false, error: { message: "Registration failed" } });
  }
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
    const message = error instanceof Error ? error.message : String(error);
    console.error("[auth/login]", error);
    if (/AUTH_SECRET|JWT_SECRET/i.test(message)) {
      return res.status(500).json({
        success: false,
        error: { message: "Server misconfigured: AUTH_SECRET is missing. Set it in Vercel env and redeploy." },
      });
    }
    if (/DATABASE_URL|Can't reach database|P1001|P1017|ECONNREFUSED|timeout/i.test(message)) {
      return res.status(503).json({
        success: false,
        error: { message: "Database unavailable. Check Neon DATABASE_URL on Vercel (and wake the compute)." },
      });
    }
    return res.status(500).json({ success: false, error: { message: "Login failed" } });
  }
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  let user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  // Stale JWT after DB re-seed / Neon switch — recover by email and re-issue token
  let remapped = false;
  if (!user && req.user?.email) {
    user = await prisma.user.findFirst({
      where: { email: { equals: req.user.email.trim(), mode: "insensitive" } },
    });
    remapped = !!user;
  }
  if (!user) {
    return res.status(404).json({
      success: false,
      error: { message: "User not found. Sign out and sign in again." },
    });
  }
  if (user.status !== "ACTIVE") {
    return res.status(403).json({ success: false, error: { message: "Account inactive" } });
  }

  const authUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    permissions: user.permissions,
  };
  const token = remapped || user.id !== req.user!.id ? signToken(authUser) : undefined;

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
      ...(token ? { token } : {}),
    },
  });
});

/** Force-refresh JWT against current Neon users (email bind). */
authRouter.post("/rebind", requireAuth, async (req: AuthedRequest, res) => {
  try {
    let user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user && req.user?.email) {
      user = await prisma.user.findFirst({
        where: { email: { equals: req.user.email.trim(), mode: "insensitive" } },
      });
    }
    if (!user || user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        error: { message: "Account inactive or not found. Sign out and sign in again." },
      });
    }
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
    console.error("[auth/rebind]", error);
    return res.status(500).json({ success: false, error: { message: "Session refresh failed" } });
  }
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

/** Logged-in admin/staff/customer: change password with current password confirmation. */
authRouter.post("/change-password", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const body = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8).max(128),
      })
      .parse(req.body);

    if (body.currentPassword === body.newPassword) {
      return res.status(400).json({
        success: false,
        error: { message: "New password must be different from the current password." },
      });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.passwordHash) {
      return res.status(404).json({ success: false, error: { message: "Account not found" } });
    }

    const ok = await compare(body.currentPassword, user.passwordHash);
    if (!ok) {
      return res.status(401).json({
        success: false,
        error: { message: "Current password is incorrect" },
      });
    }

    const passwordHash = await hash(body.newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    return res.json({
      success: true,
      data: { message: "Password changed successfully." },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { message: error.issues[0]?.message || "Invalid password input" },
      });
    }
    console.error("[auth/change-password]", error);
    return res.status(500).json({ success: false, error: { message: "Password change failed" } });
  }
});

// silence unused import warning in some tooling
void mapUiRoleToPrisma;
