export function formatGBP(amount: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2
  }).format(Number(amount || 0));
}

export function roundMoney(n: number) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
