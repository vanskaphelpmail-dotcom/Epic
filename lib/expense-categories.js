export const EXPENSE_CATEGORY_OPTIONS = [
  'Shop Rent',
  'Warehouse Rent',
  'Office Rent',
  'Storage Rent',
  'Security Deposit',
  'Service Charge',
  'Maintenance Charge',
  'Property Management Fee',
  'Electricity Bill',
  'Gas Bill',
  'Water Bill',
  'Internet Bill',
  'Wi-Fi Bill',
  'Telephone Bill',
  'Mobile Bill',
  'Generator Fuel',
  'Generator Maintenance',
  'AC Electricity',
  'Employee Salary',
  'Staff Salary',
  'Employee Bonus',
  'Staff Bonus',
  'Overtime Payment',
  'Employee Commission',
  'Staff Commission',
  'Employee Allowance',
  'Transportation Allowance',
  'Meal Allowance',
  'Employee Advance',
  'Employee Loan',
  'Employee Training',
  'Employee Recruitment',
  'Employee Uniform',
  'Employee Welfare',
  'Employee Benefits',
  'Payroll Tax',
  'Employee Medical Expense',
  'Employee Insurance',
  'Employee Attendance Adjustment',
  'Product Purchase',
  'Perfume Purchase',
  'Product Restocking',
  'Raw Materials',
  'Perfume Oil',
  'Essential Oil',
  'Fragrance Compound',
  'Alcohol',
  'Fixative',
  'Perfume Bottle',
  'Bottle Cap',
  'Spray Pump',
  'Atomizer',
  'Perfume Box',
  'Perfume Label',
  'Product Sticker',
  'Shopping Bag',
  'Gift Packaging',
  'Custom Packaging',
  'Tester Bottle',
  'Tester Liquid',
  'Sample Vial',
  'Product Sample',
  'Product Replacement',
  'Damaged Product',
  'Expired Product',
  'Lost Stock',
  'Inventory Adjustment',
  'Supplier Payment',
  'Supplier Advance',
  'Supplier Due Payment',
  'Supplier Refund',
  'Supplier Shipping',
  'Supplier Delivery Charge',
  'Supplier Service Charge'
];

export function mapExpenseCategory(label) {
  const value = String(label || '').toLowerCase();
  if (/rent|deposit|service charge|property management/.test(value)) return 'RENT';
  if (/electric|gas|water|internet|wi-fi|wifi|telephone|mobile|generator|ac electricity/.test(value)) {
    return value.includes('electric') || value.includes('generator') || value.includes('ac ') ? 'ELECTRICITY' : 'UTILITIES';
  }
  if (/employee|staff|payroll|overtime|allowance|recruitment|uniform|welfare|benefits|medical|insurance|attendance|bonus|commission|salary/.test(value)) {
    return 'EMPLOYEE_BILL';
  }
  if (/supplier/.test(value)) return 'SUPPLIER_BILL';
  if (/maintenance/.test(value)) return 'MAINTENANCE';
  if (/purchase|perfume|restock|raw|oil|fragrance|alcohol|fixative|bottle|cap|pump|atomizer|box|label|sticker|bag|packaging|tester|sample|vial|replacement|damaged|expired|lost stock|inventory/.test(value)) {
    return 'SUPPLIES';
  }
  return 'OTHER';
}

export function expenseCategoryLabel(expense) {
  return expense?.categoryLabel || expense?.category || 'Other';
}
