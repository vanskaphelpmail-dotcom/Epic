import { prisma } from '@/lib/prisma';

export async function notifyAdmins(input: {
  storeId?: string | null;
  title: string;
  message: string;
  type: string;
}) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true, ...(input.storeId ? { storeId: input.storeId } : {}) },
    select: { id: true }
  });
  if (!admins.length) return;
  try {
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        storeId: input.storeId || null,
        userId: admin.id,
        title: input.title,
        message: input.message,
        type: input.type
      }))
    });
  } catch {
    /* notifications are optional */
  }
}
