/** URL slugs for every workspace screen. Overview lives at `/`. */

export const APP_PAGES = [
  { name: 'Overview', slug: '', path: '/', title: 'Dashboard' },
  { name: 'POS', slug: 'pos', path: '/pos', title: 'POS' },
  { name: 'Invoice List', slug: 'invoices', path: '/invoices', title: 'Invoice List' },
  { name: 'Unpaid / Due', slug: 'unpaid', path: '/unpaid', title: 'Unpaid / Due' },
  { name: 'Inventory', slug: 'inventory', path: '/inventory', title: 'Inventory' },
  { name: 'Sales', slug: 'sales', path: '/sales', title: 'Sales' },
  { name: 'Attendance', slug: 'attendance', path: '/attendance', title: 'Attendance' },
  { name: 'Payroll', slug: 'payroll', path: '/payroll', title: 'Payroll' },
  { name: 'Documents', slug: 'documents', path: '/documents', title: 'Documents' },
  { name: 'Requests', slug: 'requests', path: '/requests', title: 'Requests' },
  { name: 'Expenses', slug: 'expenses', path: '/expenses', title: 'Expenses' },
  { name: 'Accounts', slug: 'accounts', path: '/accounts', title: 'Accounts' },
  { name: 'Suppliers', slug: 'suppliers', path: '/suppliers', title: 'Suppliers' },
  { name: 'Reports', slug: 'reports', path: '/reports', title: 'Reports' },
  { name: 'Audit', slug: 'audit', path: '/audit', title: 'Audit' },
  { name: 'Team & Roles', slug: 'team', path: '/team', title: 'Team & Roles' }
];

export function pathForPage(name) {
  return APP_PAGES.find((p) => p.name === name)?.path || '/';
}

export function pageFromPath(pathname) {
  const seg = String(pathname || '/')
    .replace(/\/+$/, '')
    .replace(/^\//, '')
    .split('/')[0];
  if (!seg) return 'Overview';
  return APP_PAGES.find((p) => p.slug === seg)?.name || null;
}

export function pageMeta(name) {
  return APP_PAGES.find((p) => p.name === name) || APP_PAGES[0];
}
