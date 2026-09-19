import type { AppConfig } from '../types';

export type OutletLocation = {
  city: string;
  address: string;
  phone: string;
  email?: string;
  hours?: string;
};

/** Default when CMS has no outlets yet — still overridable from Admin → Outlets. */
export const DEFAULT_OUTLET: OutletLocation = {
  city: 'Feni',
  address: 'Shop no: B: 67-68, 1st Floor, Feni Garden City Market, Feni, 3900',
  phone: '+880 1840-990700',
  email: 'support@epicvanskap.com',
  hours: '11:00 AM - 09:30 PM (Friday - Wednesday)',
};

export function normalizeOutlet(raw: unknown): OutletLocation | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const city = String(o.city || '').trim();
  const address = String(o.address || '').trim();
  const phone = String(o.phone || '').trim();
  const email = String(o.email || '').trim();
  const hours = String(o.hours || '').trim();
  if (!city && !address && !phone) return null;
  return {
    city: city || 'Outlet',
    address,
    phone,
    ...(email ? { email } : {}),
    ...(hours ? { hours } : {}),
  };
}

export function normalizeOutlets(list: unknown): OutletLocation[] {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeOutlet).filter((x): x is OutletLocation => Boolean(x));
}

/** Primary outlet used on invoices, POS, and single-contact surfaces. */
export function getPrimaryOutlet(
  locations?: OutletLocation[] | AppConfig['footerLocations'] | null,
): OutletLocation {
  const list = normalizeOutlets(locations);
  return list[0] || { ...DEFAULT_OUTLET };
}

export function getShopBrandName(logoText?: string | null): string {
  const t = String(logoText || '').trim();
  return t || 'Epic Vanskap';
}

/** Lines for invoice / receipt headers (address, phone, email). */
export function outletContactLines(
  loc: OutletLocation,
  opts?: { includeEmail?: boolean; fallbackEmail?: string },
): string[] {
  const lines: string[] = [];
  if (loc.address) lines.push(loc.address);
  const email =
    (loc.email && loc.email.trim()) ||
    (opts?.includeEmail !== false ? opts?.fallbackEmail || '' : '');
  const phone = loc.phone?.trim() || '';
  if (email && phone) {
    lines.push(`Email: ${email} • Phone: ${phone}`);
  } else if (phone) {
    lines.push(`Phone: ${phone}`);
  } else if (email) {
    lines.push(`Email: ${email}`);
  }
  return lines;
}
