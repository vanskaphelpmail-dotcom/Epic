import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@jab/db";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  permissions: string[];
};

export type AuthedRequest = Request & { user?: AuthUser };

const STAFF: UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "INVENTORY_MANAGER",
  "ORDER_MANAGER",
  "CUSTOMER_SUPPORT",
  "CONTENT_MANAGER",
];

/** Normalize JWT role (Prisma enum or legacy UI labels). */
function normalizeRole(role: unknown): UserRole | null {
  const raw = String(role || "").trim();
  if (!raw) return null;
  const upper = raw.toUpperCase().replace(/\s+/g, "_");
  if ((STAFF as string[]).includes(upper) || upper === "CUSTOMER") return upper as UserRole;
  const ui: Record<string, UserRole> = {
    Admin: "ADMIN",
    "Super Admin": "SUPER_ADMIN",
    "Inventory Manager": "INVENTORY_MANAGER",
    "Order Manager": "ORDER_MANAGER",
    "Customer Support": "CUSTOMER_SUPPORT",
    "Content Manager": "CONTENT_MANAGER",
    Customer: "CUSTOMER",
  };
  return ui[raw] || null;
}

function secret() {
  const s = (process.env.AUTH_SECRET || process.env.JWT_SECRET || "").trim();
  if (!s) throw new Error("AUTH_SECRET is required");
  return s;
}

export function signToken(user: AuthUser) {
  // No expiry — session lasts until the user explicitly logs out.
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      permissions: user.permissions,
    },
    secret(),
  );
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.token;
    const raw = header?.startsWith("Bearer ") ? header.slice(7) : cookieToken;
    if (!raw) return res.status(401).json({ success: false, error: { message: "Unauthorized" } });

    const payload = jwt.verify(raw, secret()) as jwt.JwtPayload;
    const role = normalizeRole(payload.role) || (payload.role as UserRole);
    req.user = {
      id: String(payload.sub),
      email: String(payload.email || ""),
      fullName: String(payload.fullName || ""),
      role,
      permissions: (payload.permissions as string[]) || [],
    };
    next();
  } catch {
    return res.status(401).json({ success: false, error: { message: "Invalid or expired token" } });
  }
}

export function requireStaff(req: AuthedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (!req.user || !STAFF.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          message:
            "Staff access required. Sign out and sign in again as admin@epicvanskap.com.",
        },
      });
    }
    next();
  });
}

/** Attach user when a valid Bearer token is present; never 401. */
export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.token;
    const raw = header?.startsWith("Bearer ") ? header.slice(7) : cookieToken;
    if (!raw) return next();
    const payload = jwt.verify(raw, secret()) as jwt.JwtPayload;
    const role = normalizeRole(payload.role) || (payload.role as UserRole);
    req.user = {
      id: String(payload.sub),
      email: String(payload.email || ""),
      fullName: String(payload.fullName || ""),
      role,
      permissions: (payload.permissions as string[]) || [],
    };
  } catch {
    /* ignore invalid token for optional auth */
  }
  next();
}

export function isStaffUser(user?: AuthUser | null): boolean {
  return !!user && STAFF.includes(user.role);
}

export function toPublicUser(user: AuthUser & { phone?: string | null }) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: mapRoleToUi(user.role),
    phone: user.phone ?? undefined,
    permissions: user.permissions,
  };
}

/** SPA Title Case roles — must match apps/web RolesPermissionsManager / types.UserRole */
export function mapRoleToUi(role: UserRole): string {
  const map: Record<UserRole, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Admin",
    INVENTORY_MANAGER: "Inventory Manager",
    ORDER_MANAGER: "Order Manager",
    CUSTOMER_SUPPORT: "Customer Support",
    CONTENT_MANAGER: "Content Manager",
    SELLER: "Seller",
    CUSTOMER: "Customer",
  };
  return map[role] || (STAFF.includes(role) ? "Admin" : "Customer");
}

export function mapUiRoleToPrisma(role: string): UserRole {
  const normalized = normalizeRole(role);
  if (normalized) return normalized;
  if (role === "Admin" || role === "ADMIN") return "ADMIN";
  if (role === "Seller" || role === "SELLER") return "SELLER";
  return "CUSTOMER";
}
