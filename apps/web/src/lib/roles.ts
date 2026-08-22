import type { UserRole } from "../types";

const STAFF_ROLES: UserRole[] = [
  "Super Admin",
  "Admin",
  "Inventory Manager",
  "Order Manager",
  "Customer Support",
  "Content Manager",
];

/** True for any back-office role (SPA Title Case + API-mapped "Admin"). */
export function isStaffRole(role: string | undefined | null): boolean {
  if (!role) return false;
  return STAFF_ROLES.includes(role as UserRole);
}

export function canAccessAdminPanel(role: string | undefined | null): boolean {
  return isStaffRole(role);
}

/** Staff can use the admin UI; when the live API is on, a JWT session is required. */
export function canUseAdminPanel(
  role: string | undefined | null,
  hasApiToken: boolean,
  apiEnabled: boolean,
): boolean {
  if (!canAccessAdminPanel(role)) return false;
  if (apiEnabled && !hasApiToken) return false;
  return true;
}
