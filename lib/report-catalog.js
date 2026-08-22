export const REPORT_CARDS = [
  { type: 'money', title: 'Money', hint: 'Cash and bank movements' },
  { type: 'money-ledger', title: 'Account Transaction History', hint: 'Full money ledger' },
  { type: 'expenses', title: 'Expenses', hint: 'Shop expenses and dues' },
  { type: 'loans', title: 'Loans', hint: 'Lender balances' },
  { type: 'income', title: 'Income', hint: 'Sales and other income' },
  { type: 'sales', title: 'Sales', hint: 'Invoices and payments' },
  { type: 'stock', title: 'Stock', hint: 'Inventory valuation' },
  { type: 'sales-history', title: 'Sales History', hint: 'Completed invoices' },
  { type: 'payroll', title: 'Payroll', hint: 'Salary records' },
  { type: 'attendance', title: 'Employee Attendance', hint: 'Clock in and out' },
  { type: 'inventory', title: 'Live Inventory', hint: 'Current product stock' },
  { type: 'low-stock', title: 'Low Stock', hint: 'Below minimum stock' },
  { type: 'unpaid-sales', title: 'Unpaid Sales', hint: 'Customer dues' },
  { type: 'unpaid-suppliers', title: 'Unpaid Suppliers', hint: 'Supplier dues' },
  { type: 'supplier-purchases', title: 'Supplier Purchases', hint: 'Purchase ledger' },
  { type: 'pending-dues', title: 'Total Pending Dues', hint: 'Salary and related dues' },
  { type: 'documents', title: 'Documents', hint: 'Stored files' },
  { type: 'document-activity', title: 'Document Activity', hint: 'Uploads by date' },
  { type: 'supplier-payment-history', title: 'Supplier Payment History', hint: 'Supplier payments' },
  { type: 'customer-payment-history', title: 'Customer Payment History', hint: 'Customer receipts' },
  { type: 'cash-management', title: 'Cash Management', hint: 'Cash account ledger' },
  { type: 'bank-transactions', title: 'Bank Transactions', hint: 'Bank account ledger' },
  { type: 'profit-loss', title: 'Profit & Loss', hint: 'Sales minus costs' },
  { type: 'product-sales', title: 'Product Sales', hint: 'Units sold by product' },
  { type: 'employee-sales', title: 'Employee Sales', hint: 'Sales by staff' }
];

export function reportMeta(type) {
  return REPORT_CARDS.find((c) => c.type === type) || {
    type: type || 'sales',
    title: String(type || 'Report').replace(/-/g, ' '),
    hint: ''
  };
}

export function reportTitle(type) {
  const title = reportMeta(type).title;
  return title.toLowerCase().endsWith('report') ? title : `${title} Report`;
}
