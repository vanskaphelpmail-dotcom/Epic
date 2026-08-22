export const PERMISSIONS = [
  'DASHBOARD_VIEW',
  'POS_ACCESS',
  'POS_SELL',
  'POS_REFUND',
  'POS_DISCOUNT',
  'PRODUCT_VIEW',
  'PRODUCT_CREATE',
  'PRODUCT_EDIT',
  'PRODUCT_DELETE',
  'PRODUCT_BARCODE_PRINT',
  'INVENTORY_VIEW',
  'INVENTORY_CREATE',
  'INVENTORY_EDIT',
  'INVENTORY_DELETE',
  'INVENTORY_ADJUST',
  'INVENTORY_TRANSFER',
  'STOCK_REPORT_VIEW',
  'STOCK_REPORT_EXPORT',
  'SALES_VIEW',
  'SALES_REPORT_VIEW',
  'SALES_EXPORT',
  'ATTENDANCE_VIEW',
  'ATTENDANCE_CLOCK_IN',
  'ATTENDANCE_CLOCK_OUT',
  'CASH_RECONCILIATION',
  'CUSTOMER_VIEW',
  'CUSTOMER_CREATE',
  'CUSTOMER_EDIT',
  'CUSTOMER_HISTORY_VIEW',
  'ORDER_VIEW',
  'ORDER_CREATE',
  'ORDER_EDIT',
  'ORDER_PRINT',
  'ORDER_EXPORT',
  'DOCUMENT_VIEW',
  'DOCUMENT_UPLOAD',
  'DOCUMENT_DELETE',
  'SALARY_VIEW',
  'SALARY_CREATE',
  'SALARY_EDIT',
  'SALARY_PAYMENT',
  'EXPENSE_VIEW',
  'EXPENSE_CREATE',
  'EXPENSE_EDIT',
  'EXPENSE_DELETE',
  'REPORT_VIEW',
  'REPORT_EXPORT',
  'STAFF_VIEW',
  'STAFF_CREATE',
  'STAFF_EDIT',
  'STAFF_DEACTIVATE',
  'PERMISSION_MANAGE',
  'STORE_VIEW',
  'STORE_MANAGE',
  'AUDIT_LOG_VIEW',
  'COST_VIEW',
  'PROFIT_VIEW'
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS];

/** UI access modules → permission bundles (Team & Roles access management). */
export const ACCESS_MODULES = [
  {
    id: 'overview',
    label: 'Overview / Dashboard',
    description: 'Today and last-month sales summary',
    gate: 'DASHBOARD_VIEW' as Permission,
    permissions: ['DASHBOARD_VIEW'] as Permission[]
  },
  {
    id: 'pos',
    label: 'POS',
    description: 'Sell at the till',
    gate: 'POS_ACCESS' as Permission,
    permissions: ['POS_ACCESS', 'POS_SELL', 'PRODUCT_VIEW'] as Permission[]
  },
  {
    id: 'billing',
    label: 'Invoice List',
    description: 'Invoices, return, exchange, void',
    gate: 'ORDER_VIEW' as Permission,
    permissions: ['SALES_VIEW', 'ORDER_VIEW', 'ORDER_PRINT'] as Permission[]
  },
  {
    id: 'inventory',
    label: 'Inventory',
    description: 'Stock, products, barcode print',
    gate: 'INVENTORY_VIEW' as Permission,
    permissions: [
      'PRODUCT_VIEW',
      'PRODUCT_CREATE',
      'PRODUCT_EDIT',
      'PRODUCT_BARCODE_PRINT',
      'INVENTORY_VIEW',
      'INVENTORY_ADJUST'
    ] as Permission[]
  },
  {
    id: 'sales',
    label: 'Sales (incl. last month)',
    description: 'Sales list and last-month sales view',
    gate: 'SALES_REPORT_VIEW' as Permission,
    permissions: ['SALES_VIEW', 'SALES_REPORT_VIEW'] as Permission[]
  },
  {
    id: 'attendance',
    label: 'Attendance',
    description: 'Clock in/out and attendance records',
    gate: 'ATTENDANCE_CLOCK_IN' as Permission,
    permissions: ['ATTENDANCE_VIEW', 'ATTENDANCE_CLOCK_IN', 'ATTENDANCE_CLOCK_OUT'] as Permission[]
  },
  {
    id: 'payroll',
    label: 'Payroll',
    description: 'Salary records and dues',
    gate: 'SALARY_VIEW' as Permission,
    permissions: ['SALARY_VIEW', 'SALARY_CREATE', 'SALARY_EDIT', 'SALARY_PAYMENT'] as Permission[]
  },
  {
    id: 'documents',
    label: 'Documents',
    description: 'Upload and view store documents',
    gate: 'DOCUMENT_VIEW' as Permission,
    permissions: ['DOCUMENT_VIEW', 'DOCUMENT_UPLOAD'] as Permission[]
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Excel exports (stock, sales, attendance, payroll)',
    gate: 'REPORT_VIEW' as Permission,
    permissions: [
      'REPORT_VIEW',
      'REPORT_EXPORT',
      'SALES_EXPORT',
      'STOCK_REPORT_VIEW',
      'STOCK_REPORT_EXPORT'
    ] as Permission[]
  },
  {
    id: 'team',
    label: 'Team & access management',
    description: 'Create staff and assign module access',
    gate: 'STAFF_VIEW' as Permission,
    permissions: [
      'STAFF_VIEW',
      'STAFF_CREATE',
      'STAFF_EDIT',
      'STAFF_DEACTIVATE',
      'PERMISSION_MANAGE'
    ] as Permission[]
  },
  {
    id: 'cost',
    label: 'Cost & profit',
    description: 'See purchase cost and profit columns',
    gate: 'COST_VIEW' as Permission,
    permissions: ['COST_VIEW', 'PROFIT_VIEW'] as Permission[]
  }
] as const;

export type AccessModuleId = (typeof ACCESS_MODULES)[number]['id'];

export const STAFF_POS_ONLY: Permission[] = [
  'DASHBOARD_VIEW',
  'POS_ACCESS',
  'POS_SELL',
  'ATTENDANCE_CLOCK_IN',
  'ATTENDANCE_CLOCK_OUT',
  'PRODUCT_VIEW'
];

export const ROLE_PRESETS: Record<
  string,
  { label: string; modules: AccessModuleId[]; extra?: Permission[] }
> = {
  pos: {
    label: 'POS cashier',
    modules: ['overview', 'pos', 'attendance']
  },
  manager: {
    label: 'Billing manager',
    modules: [
      'overview',
      'pos',
      'billing',
      'inventory',
      'sales',
      'attendance',
      'documents',
      'reports',
      'cost'
    ]
  },
  stock: {
    label: 'Stock keeper',
    modules: ['overview', 'inventory', 'attendance', 'reports', 'cost']
  },
  payroll: {
    label: 'Payroll clerk',
    modules: ['overview', 'attendance', 'payroll', 'reports']
  },
  full_staff: {
    label: 'Full staff access',
    modules: [
      'overview',
      'pos',
      'billing',
      'inventory',
      'sales',
      'attendance',
      'payroll',
      'documents',
      'reports'
    ]
  }
};

export function permissionsFromModules(moduleIds: string[]): Permission[] {
  const set = new Set<Permission>();
  for (const mod of ACCESS_MODULES) {
    if (moduleIds.includes(mod.id)) {
      for (const p of mod.permissions) set.add(p);
    }
  }
  // Cashiers always need product view with POS
  if (moduleIds.includes('pos')) set.add('PRODUCT_VIEW');
  return [...set];
}

export function modulesFromPermissions(permissions: string[]): AccessModuleId[] {
  return ACCESS_MODULES.filter((mod) => permissions.includes(mod.gate)).map((mod) => mod.id);
}

/** Nav page → permission required to see it */
export const NAV_ACCESS: Record<string, Permission[]> = {
  Overview: ['DASHBOARD_VIEW', 'POS_ACCESS'],
  POS: ['POS_ACCESS'],
  'Invoice List': ['SALES_VIEW', 'ORDER_VIEW'],
  'Unpaid / Due': ['SALES_VIEW', 'ORDER_VIEW'],
  Inventory: ['INVENTORY_VIEW'],
  Sales: ['SALES_VIEW', 'SALES_REPORT_VIEW'],
  Attendance: ['ATTENDANCE_VIEW', 'ATTENDANCE_CLOCK_IN', 'ATTENDANCE_CLOCK_OUT'],
  Payroll: ['SALARY_VIEW'],
  Documents: ['DOCUMENT_VIEW'],
  Requests: ['DOCUMENT_VIEW', 'SALARY_VIEW'],
  Reports: ['REPORT_VIEW', 'REPORT_EXPORT', 'STOCK_REPORT_VIEW', 'SALES_EXPORT'],
  Expenses: ['EXPENSE_VIEW', 'EXPENSE_CREATE'],
  Accounts: ['CASH_RECONCILIATION', 'EXPENSE_VIEW'],
  Suppliers: ['INVENTORY_VIEW', 'PRODUCT_VIEW'],
  Audit: ['AUDIT_LOG_VIEW', 'PERMISSION_MANAGE'],
  'Team & Roles': ['STAFF_VIEW', 'PERMISSION_MANAGE', 'STAFF_CREATE']
};

export function canAccessNav(page: string, permissions: string[], role?: string) {
  if (role === 'ADMIN') return true;
  const needed = NAV_ACCESS[page];
  if (!needed?.length) return true;
  return needed.some((p) => permissions.includes(p));
}
