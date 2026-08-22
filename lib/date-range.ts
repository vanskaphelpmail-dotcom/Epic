/** UK corporation tax / common retail FY: 1 Apr – 31 Mar */
const FY_START_MONTH = 3; // April (0-indexed)

export type DatePeriod =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'lastWeek'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisMonthLastYear'
  | 'thisYear'
  | 'lastYear'
  | 'thisFY'
  | 'lastFY'
  | 'custom'
  | 'week'
  | 'month'
  | 'year'
  | 'all';

export const DATE_PERIOD_OPTIONS: { value: DatePeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'This week' },
  { value: 'lastWeek', label: 'Last week' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'thisYear', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
  { value: 'all', label: '3-year archive' }
];

export function startOfDay(d: Date = new Date()) {
  const x = new Date(d ?? Date.now());
  if (Number.isNaN(x.getTime())) {
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date = new Date()) {
  const x = new Date(d ?? Date.now());
  if (Number.isNaN(x.getTime())) {
    const fallback = new Date();
    fallback.setHours(23, 59, 59, 999);
    return fallback;
  }
  x.setHours(23, 59, 59, 999);
  return x;
}

function financialYearBounds(reference: Date, offsetYears = 0) {
  const y = reference.getFullYear();
  const fyStartYear =
    reference.getMonth() >= FY_START_MONTH ? y + offsetYears : y - 1 + offsetYears;
  const from = startOfDay(new Date(fyStartYear, FY_START_MONTH, 1));
  const to = endOfDay(new Date(fyStartYear + 1, FY_START_MONTH, 0));
  return { from, to };
}

/** Normalize legacy period keys used by older UI chips. */
function normalizePeriod(period?: string | null): DatePeriod {
  const value = (period || 'thisMonth').toLowerCase();
  if (value === 'week') return 'last7';
  if (value === 'month') return 'thisMonth';
  if (value === 'year') return 'thisYear';
  return value as DatePeriod;
}

export function retentionStart(reference = new Date()) {
  return startOfDay(new Date(reference.getFullYear() - 2, 0, 1));
}

export function resolvePeriod(
  period?: string | null,
  customFrom?: string | Date | null,
  customTo?: string | Date | null
): { from?: Date; to?: Date; label: string } {
  const value = normalizePeriod(period);
  if (value === 'all') {
    return { from: retentionStart(), to: endOfDay(new Date()), label: '3-year' };
  }

  const now = new Date();

  if (value === 'custom') {
    if (!customFrom) {
      return resolvePeriod('thisMonth');
    }
    const from = startOfDay(new Date(customFrom));
    const to = customTo ? endOfDay(new Date(customTo)) : endOfDay(now);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return resolvePeriod('thisMonth');
    }
    return { from, to: to < from ? endOfDay(from) : to, label: 'custom' };
  }

  let from: Date;
  let to: Date = endOfDay(now);

  switch (value) {
    case 'today':
      from = startOfDay(now);
      break;
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      from = startOfDay(y);
      to = endOfDay(y);
      break;
    }
    case 'last7':
      from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      break;
    case 'lastWeek': {
      const d = startOfDay(now);
      const day = d.getDay();
      const offsetToMon = day === 0 ? -6 : 1 - day;
      const thisMon = new Date(d);
      thisMon.setDate(d.getDate() + offsetToMon);
      const lastMon = new Date(thisMon);
      lastMon.setDate(thisMon.getDate() - 7);
      from = startOfDay(lastMon);
      const lastSun = new Date(lastMon);
      lastSun.setDate(lastMon.getDate() + 6);
      to = endOfDay(lastSun);
      break;
    }
    case 'last30':
      from = startOfDay(now);
      from.setDate(from.getDate() - 29);
      break;
    case 'thisMonth':
      from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      break;
    case 'lastMonth': {
      from = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      break;
    }
    case 'thisMonthLastYear': {
      from = startOfDay(new Date(now.getFullYear() - 1, now.getMonth(), 1));
      to = endOfDay(new Date(now.getFullYear() - 1, now.getMonth() + 1, 0));
      break;
    }
    case 'thisYear':
      from = startOfDay(new Date(now.getFullYear(), 0, 1));
      break;
    case 'lastYear':
      from = startOfDay(new Date(now.getFullYear() - 1, 0, 1));
      to = endOfDay(new Date(now.getFullYear() - 1, 11, 31));
      break;
    case 'thisFY': {
      const fy = financialYearBounds(now, 0);
      from = fy.from;
      to = fy.to > now ? endOfDay(now) : fy.to;
      break;
    }
    case 'lastFY': {
      const fy = financialYearBounds(now, -1);
      from = fy.from;
      to = fy.to;
      break;
    }
    default:
      from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  return { from, to, label: value };
}

export function formatDateInput(d?: Date | null) {
  if (!d || Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateRangeLabel(from?: Date, to?: Date) {
  if (!from || !to) return 'All time';
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${fmt(from)} – ${fmt(to)}`;
}

export function isDateInRange(dateValue: string | Date | null | undefined, from?: Date, to?: Date) {
  if (!from && !to) return true;
  if (!dateValue) return false;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}
