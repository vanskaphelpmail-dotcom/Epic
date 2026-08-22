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

function secret() {
  const s = process.env.AUTH_SECRET || process.env.JWT_SECRET;
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
    req.user = {
      id: String(payload.sub),
      email: String(payload.email),
      fullName: String(payload.fullName),
      role: payload.role as UserRole,
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
      return res.status(403).json({ success: false, error: { message: "Staff access required" } });
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
    req.user = {
      id: String(payload.sub),
      email: String(payload.email),
      fullName: String(payload.fullName),
      role: payload.role as UserRole,
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

export function mapRoleToUi(role: UserRole): "Admin" | "Customer" {
  return STAFF.includes(role) ? "Admin" : "Customer";
}

export function mapUiRoleToPrisma(role: string): UserRole {
  if (role === "Admin") return "ADMIN";
  return "CUSTOMER";
}
