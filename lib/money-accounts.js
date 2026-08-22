export const MONEY_TRANSACTION_TYPES = [
  { key: 'CASH_IN', label: 'Cash In', direction: 'IN', accountKind: 'cash', partyKind: null },
  { key: 'CASH_OUT', label: 'Cash Out', direction: 'OUT', accountKind: 'cash', partyKind: null },
  { key: 'CASH_DEPOSIT', label: 'Cash Deposit', direction: 'IN', accountKind: 'cash', partyKind: null },
  { key: 'CASH_WITHDRAWAL', label: 'Cash Withdrawal', direction: 'OUT', accountKind: 'cash', partyKind: null },
  { key: 'HAND_CASH', label: 'Hand Cash', direction: 'IN', accountKind: 'cash', partyKind: null },
  { key: 'BANK_DEPOSIT', label: 'Bank Deposit', direction: 'IN', accountKind: 'bank', partyKind: null },
  { key: 'BANK_WITHDRAWAL', label: 'Bank Withdrawal', direction: 'OUT', accountKind: 'bank', partyKind: null },
  { key: 'BANK_PAYMENT', label: 'Bank Payment', direction: 'OUT', accountKind: 'bank', partyKind: null },
  { key: 'BANK_MONEY_IN', label: 'Bank Money In', direction: 'IN', accountKind: 'bank', partyKind: null },
  { key: 'BANK_MONEY_OUT', label: 'Bank Money Out', direction: 'OUT', accountKind: 'bank', partyKind: null },
  { key: 'BANK_TRANSFER', label: 'Bank Transfer', direction: 'TRANSFER', accountKind: 'transfer', partyKind: null, fields: ['transfer'] },
  { key: 'CASH_TRANSFER', label: 'Cash Transfer', direction: 'TRANSFER', accountKind: 'transfer', partyKind: null, fields: ['transfer'] },
  { key: 'CASH_RECEIVED', label: 'Cash Received', direction: 'IN', accountKind: 'cash', partyKind: 'receivedFrom', fields: ['personFrom', 'phone', 'reason'] },
  { key: 'CASH_GIVEN', label: 'Cash Given', direction: 'OUT', accountKind: 'cash', partyKind: 'givenTo', fields: ['personTo', 'phone', 'reason'] },
  { key: 'MONEY_RECEIVED', label: 'Money Received From Person', direction: 'IN', accountKind: 'any', partyKind: 'receivedFrom', fields: ['personFrom', 'phone', 'reason'] },
  { key: 'MONEY_GIVEN', label: 'Money Given To Person', direction: 'OUT', accountKind: 'any', partyKind: 'givenTo', fields: ['personTo', 'phone', 'reason'] },
  { key: 'CUSTOMER_PAYMENT', label: 'Customer Payment', direction: 'IN', accountKind: 'any', partyKind: 'customer', fields: ['personFrom'] },
  { key: 'CUSTOMER_DUE_PAYMENT', label: 'Customer Due Payment', direction: 'IN', accountKind: 'any', partyKind: 'customer', fields: ['personFrom'] },
  { key: 'SUPPLIER_PAYMENT', label: 'Supplier Payment', direction: 'OUT', accountKind: 'any', partyKind: 'supplier', fields: ['personTo'] },
  { key: 'SUPPLIER_DUE_PAYMENT', label: 'Supplier Due Payment', direction: 'OUT', accountKind: 'any', partyKind: 'supplier', fields: ['personTo'] },
  { key: 'SUPPLIER_REFUND', label: 'Supplier Refund', direction: 'IN', accountKind: 'any', partyKind: 'supplier', fields: ['personFrom'] },
  { key: 'EMPLOYEE_PAYMENT', label: 'Employee Payment', direction: 'OUT', accountKind: 'any', partyKind: 'employee', fields: ['personTo'] },
  { key: 'EMPLOYEE_ADVANCE', label: 'Employee Advance', direction: 'OUT', accountKind: 'any', partyKind: 'employee', fields: ['personTo'] },
  { key: 'EMPLOYEE_LOAN', label: 'Employee Loan', direction: 'OUT', accountKind: 'any', partyKind: 'employee', fields: ['personTo'] },
  { key: 'SALARY_PAYMENT', label: 'Salary Payment', direction: 'OUT', accountKind: 'any', partyKind: 'employee', fields: ['personTo'] },
  { key: 'SALES_INCOME', label: 'Sales Income', direction: 'IN', accountKind: 'any', partyKind: null },
  { key: 'OTHER_INCOME', label: 'Other Income', direction: 'IN', accountKind: 'any', partyKind: null },
  { key: 'INVESTMENT_RECEIVED', label: 'Investment Received', direction: 'IN', accountKind: 'any', partyKind: 'owner', fields: ['personFrom'] },
  { key: 'OWNER_INVESTMENT', label: 'Owner Investment', direction: 'IN', accountKind: 'any', partyKind: 'owner' },
  { key: 'OWNER_WITHDRAWAL', label: 'Owner Withdrawal', direction: 'OUT', accountKind: 'any', partyKind: 'owner' },
  { key: 'BUSINESS_CAPITAL', label: 'Business Capital Added', direction: 'IN', accountKind: 'any', partyKind: 'owner' },
  { key: 'LOAN_RECEIVED', label: 'Loan Received', direction: 'IN', accountKind: 'any', partyKind: 'receivedFrom', fields: ['personFrom'] },
  { key: 'LOAN_REPAYMENT', label: 'Loan Repayment', direction: 'OUT', accountKind: 'any', partyKind: 'givenTo', fields: ['personTo'] },
  { key: 'EXPENSE_PAYMENT', label: 'Expense Payment', direction: 'OUT', accountKind: 'any', partyKind: null },
  { key: 'RENT_PAYMENT', label: 'Rent Payment', direction: 'OUT', accountKind: 'any', partyKind: null },
  { key: 'ELECTRICITY_PAYMENT', label: 'Electricity Payment', direction: 'OUT', accountKind: 'any', partyKind: null },
  { key: 'UTILITY_PAYMENT', label: 'Utility Payment', direction: 'OUT', accountKind: 'any', partyKind: null },
  { key: 'BANK_CHARGE', label: 'Bank Charge', direction: 'OUT', accountKind: 'bank', partyKind: null },
  { key: 'GATEWAY_INCOME', label: 'Payment Gateway Income', direction: 'IN', accountKind: 'bank', partyKind: null },
  { key: 'GATEWAY_CHARGE', label: 'Payment Gateway Charge', direction: 'OUT', accountKind: 'bank', partyKind: null },
  { key: 'REFUND_RECEIVED', label: 'Refund Received', direction: 'IN', accountKind: 'any', partyKind: null },
  { key: 'REFUND_GIVEN', label: 'Refund Given', direction: 'OUT', accountKind: 'any', partyKind: 'customer' },
  { key: 'ADJUSTMENT', label: 'Adjustment', direction: 'ADJUST', accountKind: 'any', partyKind: null, fields: ['adjustment'] },
  { key: 'OPENING_BALANCE', label: 'Opening Balance', direction: 'IN', accountKind: 'any', partyKind: null },
  { key: 'CLOSING_BALANCE', label: 'Closing Balance', direction: 'ADJUST', accountKind: 'any', partyKind: null },
  { key: 'OTHER', label: 'Other', direction: 'IN', accountKind: 'any', partyKind: null }
];

export const PERSON_TYPES = ['Customer', 'Employee', 'Supplier', 'Owner', 'Partner', 'Investor', 'Manager', 'Delivery Rider', 'Other Person'];

export function accountsForType(accounts, type) {
  const kind = type?.accountKind || 'any';
  const list = (accounts || []).filter((a) => a.status !== 'INACTIVE');
  if (kind === 'cash') return list.filter((a) => a.kind === 'CASH');
  if (kind === 'bank') return list.filter((a) => ['BANK', 'CARD', 'MOBILE', 'GATEWAY'].includes(a.kind));
  if (kind === 'transfer') return list;
  return list;
}

export function partyLabel(type) {
  const kind = type?.partyKind;
  if (kind === 'receivedFrom') return 'Received from';
  if (kind === 'givenTo') return 'Given to';
  if (kind === 'supplier') return type?.direction === 'IN' ? 'Received from supplier' : 'Paid to supplier';
  if (kind === 'customer') return type?.direction === 'OUT' ? 'Paid to customer' : 'Received from customer';
  if (kind === 'employee') return 'Paid to employee';
  if (kind === 'owner') return type?.direction === 'OUT' ? 'Paid to owner / partner' : 'Received from owner / partner';
  return 'Source / recipient';
}

export function accountFieldLabel(type) {
  const kind = type?.accountKind;
  if (kind === 'cash') return 'Cash account';
  if (kind === 'bank') return 'Bank account';
  if (kind === 'transfer') return 'Account';
  return 'Account (where the money sits)';
}

export const DEFAULT_MONEY_ACCOUNTS = [
  { name: 'Cash / Till', kind: 'CASH', locationKey: 'CASH_TILL', isDefaultCash: true },
  { name: 'Hand Cash', kind: 'CASH', locationKey: 'HAND_CASH' },
  { name: 'Petty Cash', kind: 'CASH', locationKey: 'PETTY_CASH' },
  { name: 'Safe / Cash Box', kind: 'CASH', locationKey: 'SAFE' },
  { name: 'Main Bank Account', kind: 'BANK', locationKey: 'MAIN_BANK', isDefaultBank: true },
  { name: 'Savings Account', kind: 'BANK', locationKey: 'SAVINGS' },
  { name: 'Business Bank Account', kind: 'BANK', locationKey: 'BUSINESS_BANK' },
  { name: 'Current Account', kind: 'BANK', locationKey: 'CURRENT' },
  { name: 'Credit Card', kind: 'CARD', locationKey: 'CREDIT_CARD' },
  { name: 'Mobile Banking', kind: 'MOBILE', locationKey: 'MOBILE_BANKING' },
  { name: 'bKash', kind: 'MOBILE', locationKey: 'BKASH' },
  { name: 'Nagad', kind: 'MOBILE', locationKey: 'NAGAD' },
  { name: 'Rocket', kind: 'MOBILE', locationKey: 'ROCKET' },
  { name: 'PayPal', kind: 'GATEWAY', locationKey: 'PAYPAL' },
  { name: 'Stripe', kind: 'GATEWAY', locationKey: 'STRIPE' },
  { name: 'Payment Gateway', kind: 'GATEWAY', locationKey: 'PAYMENT_GATEWAY' },
  { name: 'Other Bank', kind: 'BANK', locationKey: 'OTHER_BANK' },
  { name: 'Other Account', kind: 'OTHER', locationKey: 'OTHER_ACCOUNT' }
];

export const PAYMENT_METHODS = [
  { key: 'CASH', label: 'Cash' },
  { key: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { key: 'CARD', label: 'Card' },
  { key: 'BKASH', label: 'bKash' },
  { key: 'NAGAD', label: 'Nagad' },
  { key: 'ROCKET', label: 'Rocket' },
  { key: 'MOBILE_BANKING', label: 'Mobile Banking' },
  { key: 'OTHER', label: 'Other' }
];

export function findMoneyType(key) {
  return MONEY_TRANSACTION_TYPES.find((item) => item.key === key) || {
    key: key || 'OTHER',
    label: String(key || 'Other').replace(/_/g, ' '),
    direction: 'IN',
    accountKind: 'any',
    partyKind: null,
    fields: []
  };
}

export function legacyAccountType(typeKey, direction) {
  if (typeKey === 'SALES_INCOME' || typeKey === 'CUSTOMER_PAYMENT' || typeKey === 'CUSTOMER_DUE_PAYMENT') return 'SALE';
  if (typeKey === 'OPENING_BALANCE') return 'OPENING';
  if (typeKey === 'ADJUSTMENT' || typeKey === 'CLOSING_BALANCE') return 'ADJUSTMENT';
  if (typeKey === 'LOAN_RECEIVED' || typeKey === 'LOAN_REPAYMENT') return 'LOAN';
  if (['EXPENSE_PAYMENT', 'RENT_PAYMENT', 'ELECTRICITY_PAYMENT', 'UTILITY_PAYMENT', 'SUPPLIER_PAYMENT', 'SALARY_PAYMENT'].includes(typeKey)) {
    return 'EXPENSE';
  }
  if (direction === 'IN' && /BANK|GATEWAY|CARD/.test(typeKey)) return 'BANK_IN';
  if (direction === 'OUT' && /BANK|GATEWAY|CARD/.test(typeKey)) return 'BANK_OUT';
  if (direction === 'OUT') return 'CASH_OUT';
  return 'CASH_IN';
}
