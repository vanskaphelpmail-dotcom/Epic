import { Router } from "express";
import { z } from "zod";
import { hash } from "bcryptjs";
import { prisma, type UserRole, type UserStatus } from "@jab/db";
import { requireStaff, type AuthedRequest } from "../middleware/auth";
import { requirePermission, ROLE_DEFAULT_FLAGS } from "../lib/permissions";

export const usersRouter = Router();

const UI_TO_PRISMA: Record<string, UserRole> = {
  "Super Admin": "SUPER_ADMIN",
  Admin: "ADMIN",
  "Inventory Manager": "INVENTORY_MANAGER",
  "Order Manager": "ORDER_MANAGER",
  "Customer Support": "CUSTOMER_SUPPORT",
  "Content Manager": "CONTENT_MANAGER",
  Seller: "SELLER",
  Customer: "CUSTOMER",
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  INVENTORY_MANAGER: "INVENTORY_MANAGER",
  ORDER_MANAGER: "ORDER_MANAGER",
  CUSTOMER_SUPPORT: "CUSTOMER_SUPPORT",
  CONTENT_MANAGER: "CONTENT_MANAGER",
  SELLER: "SELLER",
  CUSTOMER: "CUSTOMER",
};

const PRISMA_TO_UI: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  INVENTORY_MANAGER: "Inventory Manager",
  ORDER_MANAGER: "Order Manager",
  CUSTOMER_SUPPORT: "Customer Support",
  CONTENT_MANAGER: "Content Manager",
  SELLER: "Seller",
  CUSTOMER: "Customer",
};

const STAFF_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "INVENTORY_MANAGER",
  "ORDER_MANAGER",
  "CUSTOMER_SUPPORT",
  "CONTENT_MANAGER",
  "SELLER",
];

function mapStatusToUi(status: UserStatus): "Active" | "Inactive" | "Suspended" {
  if (status === "SUSPENDED") return "Suspended";
  if (status === "INACTIVE") return "Inactive";
  return "Active";
}

function mapStatusToPrisma(status?: string): UserStatus {
  const s = String(status || "ACTIVE").toUpperCase();
  if (s === "SUSPENDED") return "SUSPENDED";
  if (s === "INACTIVE" || s === "BANNED") return "INACTIVE";
  return "ACTIVE";
}

function toStaffUser(u: {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  phone: string | null;
  location: string | null;
  department: string | null;
  avatarUrl: string | null;
  permissions: string[];
  createdAt: Date;
  lastLoginAt: Date | null;
  assignedBy?: { fullName: string } | null;
}) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: PRISMA_TO_UI[u.role] || u.role,
    status: mapStatusToUi(u.status),
    phone: u.phone ?? undefined,
    location: u.location ?? undefined,
    department: u.department ?? undefined,
    avatar: u.avatarUrl ?? undefined,
    permissions: u.permissions,
    accessFlags: (u as { accessFlags?: Record<string, boolean> | null }).accessFlags || undefined,
    assignedBy: u.assignedBy?.fullName,
    createdAt: u.createdAt.toISOString().slice(0, 10),
    lastLogin: u.lastLoginAt
      ? u.lastLoginAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
      : undefined,
  };
}

function toCustomerProfile(u: {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  location: string | null;
  createdAt: Date;
  _count?: { orders: number };
  orders?: { total: unknown }[];
}) {
  const totalSpent = (u.orders || []).reduce((sum, o) => sum + Number(o.total || 0), 0);
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone || "",
    address: u.location || "",
    city: u.location || "",
    location: u.location || "",
    notes: "",
    ordersCount: u._count?.orders ?? u.orders?.length ?? 0,
    totalSpent,
    joinedDate: u.createdAt.toISOString().slice(0, 10),
  };
}

usersRouter.get("/", requireStaff, async (req: AuthedRequest, res) => {
  try {
    const roleFilter = String(req.query.role || "").toLowerCase();
    const where =
      roleFilter === "customer" || roleFilter === "customers"
        ? { role: "CUSTOMER" as const }
        : roleFilter === "staff"
          ? { role: { in: STAFF_ROLES } }
          : {};

    const users = await prisma.user.findMany({
      where,
      include: {
        assignedBy: { select: { fullName: true } },
        _count: { select: { orders: true } },
        orders: { select: { total: true }, take: 200 },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    if (roleFilter === "customer" || roleFilter === "customers") {
      return res.json({
        success: true,
        data: { items: users.map(toCustomerProfile) },
      });
    }

    if (roleFilter === "staff") {
      return res.json({
        success: true,
        data: { items: users.map(toStaffUser) },
      });
    }

    return res.json({
      success: true,
      data: {
        staff: users.filter((u) => STAFF_ROLES.includes(u.role)).map(toStaffUser),
        customers: users.filter((u) => u.role === "CUSTOMER").map(toCustomerProfile),
      },
    });
  } catch (error) {
    console.error("[GET /users]", error);
    return res.status(500).json({ success: false, error: { message: "Failed to list users" } });
  }
});

const createSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  password: z.string().min(8),
  role: z.string(),
  phone: z.string().optional(),
  location: z.string().optional(),
  department: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  status: z.string().optional(),
});

usersRouter.post("/", requirePermission("can_manage_users"), async (req: AuthedRequest, res) => {
  try {
    const body = createSchema.parse(req.body);
    const role = UI_TO_PRISMA[body.role] || "CUSTOMER";
    if (role === "SUPER_ADMIN" && req.user!.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        error: { message: "Only Super Admin can create Super Admin accounts" },
      });
    }
    const passwordHash = await hash(body.password, 12);
    const created = await prisma.user.create({
      data: {
        email: body.email.toLowerCase().trim(),
        fullName: body.fullName.trim(),
        passwordHash,
        role,
        phone: body.phone,
        location: body.location,
        department: body.department,
        permissions: body.permissions || (role === "SUPER_ADMIN" ? ["*"] : []),
        accessFlags: ROLE_DEFAULT_FLAGS[role] || ROLE_DEFAULT_FLAGS.CUSTOMER,
        status: mapStatusToPrisma(body.status),
        assignedById: req.user!.id,
      },
      include: { assignedBy: { select: { fullName: true } } },
    });
    return res.status(201).json({
      success: true,
      data: role === "CUSTOMER" ? toCustomerProfile(created) : toStaffUser(created),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { message: error.issues[0]?.message || "Invalid user" },
      });
    }
    console.error("[POST /users]", error);
    return res.status(400).json({
      success: false,
      error: { message: error instanceof Error ? error.message : "Failed to create user" },
    });
  }
});

const updateSchema = z.object({
  fullName: z.string().min(2).optional(),
  role: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  department: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  status: z.string().optional(),
  password: z.string().min(8).optional(),
  accessFlags: z.record(z.string(), z.boolean()).optional(),
});

usersRouter.patch("/:id", requirePermission("can_manage_users"), async (req: AuthedRequest, res) => {
  try {
    // Super Admin accounts can only be edited by Super Admin
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true } });
    if (target?.role === "SUPER_ADMIN" && req.user!.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        error: { message: "Only Super Admin can edit Super Admin accounts" },
      });
    }
    const body = updateSchema.parse(req.body);
    if (body.role === "Super Admin" || body.role === "SUPER_ADMIN") {
      if (req.user!.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          error: { message: "Only Super Admin can assign Super Admin role" },
        });
      }
    }
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(body.fullName != null ? { fullName: body.fullName } : {}),
        ...(body.role != null ? { role: UI_TO_PRISMA[body.role] || "CUSTOMER" } : {}),
        ...(body.phone != null ? { phone: body.phone } : {}),
        ...(body.location != null ? { location: body.location } : {}),
        ...(body.department != null ? { department: body.department } : {}),
        ...(body.permissions != null ? { permissions: body.permissions } : {}),
        ...(body.status != null ? { status: mapStatusToPrisma(body.status) } : {}),
        ...(body.password ? { passwordHash: await hash(body.password, 12) } : {}),
        ...(body.accessFlags != null ? { accessFlags: body.accessFlags } : {}),
      },
      include: {
        assignedBy: { select: { fullName: true } },
        _count: { select: { orders: true } },
        orders: { select: { total: true }, take: 200 },
      },
    });
    return res.json({
      success: true,
      data:
        updated.role === "CUSTOMER" ? toCustomerProfile(updated) : toStaffUser(updated),
    });
  } catch (error) {
    console.error("[PATCH /users/:id]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to update user" } });
  }
});

usersRouter.delete("/:id", requirePermission("can_manage_users"), async (req: AuthedRequest, res) => {
  try {
    if (req.user!.role !== "SUPER_ADMIN") {
      return res.status(403).json({ success: false, error: { message: "Super Admin only" } });
    }
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ success: false, error: { message: "Cannot delete yourself" } });
    }
    await prisma.user.update({
      where: { id: req.params.id },
      data: { status: "INACTIVE" },
    });
    return res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error("[DELETE /users/:id]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to deactivate user" } });
  }
});
