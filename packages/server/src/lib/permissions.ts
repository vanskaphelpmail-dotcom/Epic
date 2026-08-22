import type { NextFunction, Response } from "express";
import type { UserRole } from "@jab/db";
import { prisma } from "@jab/db";
import { requireStaff, type AuthedRequest, type AuthUser } from "../middleware/auth";

/** Matches SPA AccessPermissionFlags (+ derived helpers). */
export type PermissionFlag =
  | "can_edit_stock"
  | "can_delete_orders"
  | "can_manage_products"
  | "can_process_refunds"
  | "can_edit_prices"
  | "can_manage_content"
  | "can_manage_users"
  | "can_manage_seller_desk"
  | "can_export_reports"
  | "can_edit_coupons"
  | "can_manage_system_settings"
  | "can_manage_orders"
  | "can_manage_reviews";

export type AccessFlags = Record<PermissionFlag, boolean>;

const FLAG_KEYS: PermissionFlag[] = [
  "can_edit_stock",
  "can_delete_orders",
  "can_manage_products",
  "can_process_refunds",
  "can_edit_prices",
  "can_manage_content",
  "can_manage_users",
  "can_manage_seller_desk",
  "can_export_reports",
  "can_edit_coupons",
  "can_manage_system_settings",
  "can_manage_orders",
  "can_manage_reviews",
];

const emptyFlags = (): AccessFlags =>
  Object.fromEntries(FLAG_KEYS.map((k) => [k, false])) as AccessFlags;

/** Role defaults — mirrors apps/web RolesPermissionsManager. */
export const ROLE_DEFAULT_FLAGS: Record<UserRole, AccessFlags> = {
  SUPER_ADMIN: {
    can_edit_stock: true,
    can_delete_orders: true,
    can_manage_products: true,
    can_process_refunds: true,
    can_edit_prices: true,
    can_manage_content: true,
    can_manage_users: true,
    can_manage_seller_desk: true,
    can_export_reports: true,
    can_edit_coupons: true,
    can_manage_system_settings: true,
    can_manage_orders: true,
    can_manage_reviews: true,
  },
  ADMIN: {
    can_edit_stock: true,
    can_delete_orders: false,
    can_manage_products: true,
    can_process_refunds: true,
    can_edit_prices: true,
    can_manage_content: true,
    can_manage_users: false,
    can_manage_seller_desk: true,
    can_export_reports: true,
    can_edit_coupons: true,
    can_manage_system_settings: false,
    can_manage_orders: true,
    can_manage_reviews: true,
  },
  INVENTORY_MANAGER: {
    can_edit_stock: true,
    can_delete_orders: false,
    can_manage_products: true,
    can_process_refunds: false,
    can_edit_prices: false,
    can_manage_content: false,
    can_manage_users: false,
    can_manage_seller_desk: false,
    can_export_reports: true,
    can_edit_coupons: false,
    can_manage_system_settings: false,
    can_manage_orders: false,
    can_manage_reviews: false,
  },
  ORDER_MANAGER: {
    can_edit_stock: false,
    can_delete_orders: true,
    can_manage_products: false,
    can_process_refunds: true,
    can_edit_prices: false,
    can_manage_content: false,
    can_manage_users: false,
    can_manage_seller_desk: false,
    can_export_reports: true,
    can_edit_coupons: false,
    can_manage_system_settings: false,
    can_manage_orders: true,
    can_manage_reviews: false,
  },
  CUSTOMER_SUPPORT: {
    can_edit_stock: false,
    can_delete_orders: false,
    can_manage_products: false,
    can_process_refunds: false,
    can_edit_prices: false,
    can_manage_content: false,
    can_manage_users: false,
    can_manage_seller_desk: false,
    can_export_reports: false,
    can_edit_coupons: false,
    can_manage_system_settings: false,
    can_manage_orders: false,
    can_manage_reviews: true,
  },
  CONTENT_MANAGER: {
    can_edit_stock: false,
    can_delete_orders: false,
    can_manage_products: false,
    can_process_refunds: false,
    can_edit_prices: false,
    can_manage_content: true,
    can_manage_users: false,
    can_manage_seller_desk: false,
    can_export_reports: false,
    can_edit_coupons: true,
    can_manage_system_settings: false,
    can_manage_orders: false,
    can_manage_reviews: true,
  },
  SELLER: {
    can_edit_stock: false,
    can_delete_orders: false,
    can_manage_products: false,
    can_process_refunds: false,
    can_edit_prices: false,
    can_manage_content: false,
    can_manage_users: false,
    can_manage_seller_desk: true,
    can_export_reports: false,
    can_edit_coupons: false,
    can_manage_system_settings: false,
    can_manage_orders: false,
    can_manage_reviews: false,
  },
  CUSTOMER: emptyFlags(),
};

/** Map legacy string permissions[] → flags. */
const PERMISSION_STRING_MAP: Record<string, PermissionFlag[]> = {
  "*": FLAG_KEYS,
  all_access: FLAG_KEYS,
  can_edit_stock: ["can_edit_stock"],
  can_delete_orders: ["can_delete_orders"],
  can_manage_products: ["can_manage_products"],
  can_process_refunds: ["can_process_refunds"],
  can_edit_prices: ["can_edit_prices"],
  can_manage_content: ["can_manage_content"],
  can_manage_users: ["can_manage_users"],
  can_manage_seller_desk: ["can_manage_seller_desk"],
  can_export_reports: ["can_export_reports"],
  can_edit_coupons: ["can_edit_coupons"],
  can_manage_system_settings: ["can_manage_system_settings"],
  manage_products: ["can_manage_products"],
  manage_inventory: ["can_edit_stock"],
  stock_adjustment: ["can_edit_stock"],
  restock_logs: ["can_edit_stock"],
  manage_orders: ["can_manage_orders", "can_delete_orders", "can_process_refunds"],
  manage_courier: ["can_manage_orders"],
  process_refunds: ["can_process_refunds"],
  print_invoices: ["can_manage_orders"],
  manage_customers: ["can_export_reports"],
  view_customers: ["can_export_reports"],
  view_orders: ["can_manage_orders"],
  manage_reviews: ["can_manage_reviews"],
  manage_content: ["can_manage_content"],
  manage_banners: ["can_manage_content"],
  manage_blogs: ["can_manage_content"],
  manage_pages: ["can_manage_content"],
  manage_gallery: ["can_manage_content"],
  manage_seller_desk: ["can_manage_seller_desk"],
  manage_users: ["can_manage_users"],
  system_settings: ["can_manage_system_settings"],
};

export function resolveAccessFlags(
  role: UserRole,
  accessFlags?: Record<string, boolean> | null,
  permissions: string[] = [],
): AccessFlags {
  if (role === "SUPER_ADMIN" || permissions.includes("*") || permissions.includes("all_access")) {
    return { ...ROLE_DEFAULT_FLAGS.SUPER_ADMIN };
  }

  const resolved: AccessFlags = { ...(ROLE_DEFAULT_FLAGS[role] || emptyFlags()) };

  for (const raw of permissions) {
    const key = String(raw || "").trim();
    const mapped = PERMISSION_STRING_MAP[key];
    if (mapped) {
      for (const f of mapped) resolved[f] = true;
    } else if ((FLAG_KEYS as string[]).includes(key)) {
      resolved[key as PermissionFlag] = true;
    }
  }

  if (accessFlags && typeof accessFlags === "object") {
    for (const f of FLAG_KEYS) {
      if (typeof accessFlags[f] === "boolean") {
        resolved[f] = accessFlags[f]!;
      }
    }
  }

  // Derived: order ops from refund/cancel if role defaults omitted can_manage_orders
  if (resolved.can_delete_orders || resolved.can_process_refunds) {
    resolved.can_manage_orders = true;
  }

  return resolved;
}

export function hasAllPermissions(flags: AccessFlags, needed: PermissionFlag[]): boolean {
  return needed.every((f) => !!flags[f]);
}

export function hasAnyPermission(flags: AccessFlags, needed: PermissionFlag[]): boolean {
  return needed.some((f) => !!flags[f]);
}

export type AuthedRequestWithFlags = AuthedRequest & {
  accessFlags?: AccessFlags;
};

/** Load fresh flags from DB (permission changes apply immediately). */
export async function loadUserAccessFlags(userId: string): Promise<{
  user: AuthUser & { status: string };
  flags: AccessFlags;
} | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      permissions: true,
      accessFlags: true,
      status: true,
    },
  });
  if (!row) return null;
  const flags = resolveAccessFlags(
    row.role,
    (row.accessFlags as Record<string, boolean> | null) || null,
    row.permissions || [],
  );
  return {
    user: {
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      role: row.role,
      permissions: row.permissions || [],
      status: row.status,
    },
    flags,
  };
}

/**
 * Staff + must have ALL listed flags (fresh from DB).
 * Super Admin / * always passes.
 */
export function requirePermission(...needed: PermissionFlag[]) {
  return (req: AuthedRequestWithFlags, res: Response, next: NextFunction) => {
    requireStaff(req, res, () => {
      void (async () => {
        try {
          const loaded = await loadUserAccessFlags(req.user!.id);
          if (!loaded || loaded.user.status !== "ACTIVE") {
            return res.status(403).json({
              success: false,
              error: { message: "Account inactive or not found" },
            });
          }
          // Refresh role from DB (JWT may be stale)
          req.user = {
            id: loaded.user.id,
            email: loaded.user.email,
            fullName: loaded.user.fullName,
            role: loaded.user.role,
            permissions: loaded.user.permissions,
          };
          req.accessFlags = loaded.flags;

          if (loaded.user.role === "SUPER_ADMIN" || loaded.user.permissions.includes("*")) {
            return next();
          }
          if (!hasAllPermissions(loaded.flags, needed)) {
            return res.status(403).json({
              success: false,
              error: {
                message: `Missing permission: ${needed.join(", ")}`,
                required: needed,
              },
            });
          }
          return next();
        } catch (err) {
          console.error("[requirePermission]", err);
          return res.status(500).json({
            success: false,
            error: { message: "Permission check failed" },
          });
        }
      })();
    });
  };
}

/** Staff + must have ANY of the listed flags. */
export function requireAnyPermission(...needed: PermissionFlag[]) {
  return (req: AuthedRequestWithFlags, res: Response, next: NextFunction) => {
    requireStaff(req, res, () => {
      void (async () => {
        try {
          const loaded = await loadUserAccessFlags(req.user!.id);
          if (!loaded || loaded.user.status !== "ACTIVE") {
            return res.status(403).json({
              success: false,
              error: { message: "Account inactive or not found" },
            });
          }
          req.user = {
            id: loaded.user.id,
            email: loaded.user.email,
            fullName: loaded.user.fullName,
            role: loaded.user.role,
            permissions: loaded.user.permissions,
          };
          req.accessFlags = loaded.flags;

          if (loaded.user.role === "SUPER_ADMIN" || loaded.user.permissions.includes("*")) {
            return next();
          }
          if (!hasAnyPermission(loaded.flags, needed)) {
            return res.status(403).json({
              success: false,
              error: {
                message: `Missing permission (need one of): ${needed.join(", ")}`,
                requiredAny: needed,
              },
            });
          }
          return next();
        } catch (err) {
          console.error("[requireAnyPermission]", err);
          return res.status(500).json({
            success: false,
            error: { message: "Permission check failed" },
          });
        }
      })();
    });
  };
}
