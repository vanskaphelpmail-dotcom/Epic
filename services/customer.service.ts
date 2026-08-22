import { prisma } from '@/lib/prisma';

export async function listCustomers(storeId?: string) {
  return prisma.customer.findMany({
    where: storeId ? { storeId } : {},
    orderBy: { updatedAt: 'desc' }
  });
}
