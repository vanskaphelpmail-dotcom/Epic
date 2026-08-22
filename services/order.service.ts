import { prisma } from '@/lib/prisma';

export async function nextOrderNumber() {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;
  const latest = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' }
  });
  const next = latest ? Number(latest.orderNumber.split('-').pop()) + 1 : 1;
  return `${prefix}${String(next).padStart(6, '0')}`;
}
