export function roundSupplierMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function supplierDueStatus(supplier, now = new Date()) {
  const due = roundSupplierMoney(supplier?.unpaidAmount);
  const paid = roundSupplierMoney(supplier?.paidAmount);
  if (due <= 0) return 'Paid';
  if (supplier?.dueDate) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const dueDay = new Date(supplier.dueDate);
    dueDay.setHours(0, 0, 0, 0);
    const days = Math.round((dueDay.getTime() - start.getTime()) / 86400000);
    if (days < 0) return 'Overdue';
    if (days <= 7) return 'Due Soon';
  }
  if (paid <= 0) return 'Unpaid';
  return 'Partially Paid';
}

export function decorateSupplier(supplier) {
  const totalPurchase = roundSupplierMoney(
    supplier?.totalPurchase ?? (Number(supplier?.paidAmount || 0) + Number(supplier?.unpaidAmount || 0))
  );
  return {
    ...supplier,
    totalPurchase,
    paidAmount: roundSupplierMoney(supplier?.paidAmount),
    unpaidAmount: roundSupplierMoney(supplier?.unpaidAmount),
    status: supplierDueStatus({
      paidAmount: supplier?.paidAmount,
      unpaidAmount: supplier?.unpaidAmount,
      dueDate: supplier?.dueDate
    })
  };
}
