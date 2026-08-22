import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { ALL_PERMISSIONS } from '@/lib/permissions';

/** Create or update the shop admin from INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD. */
export async function ensureAdminFromEnv() {
  const email = (process.env.INITIAL_ADMIN_EMAIL || '').toLowerCase().trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD || '';
  if (!email || !password) return null;

  const store = await prisma.store.upsert({
    where: { code: 'STORE-001' },
    update: {
      name: 'The Ouds',
      address: '136A Woodville Road, CF24 4EE, Cardiff',
      phone: '+447454 045315',
      logoUrl: '/the-ouds-logo.png',
      isActive: true
    },
    create: {
      code: 'STORE-001',
      name: 'The Ouds',
      address: '136A Woodville Road, CF24 4EE, Cardiff',
      phone: '+447454 045315',
      logoUrl: '/the-ouds-logo.png',
      currency: 'GBP',
      isActive: true
    }
  });

  const passwordHash = await bcrypt.hash(password, 12);
  let admin =
    (await prisma.user.findUnique({ where: { email } })) ||
    (await prisma.user.findUnique({ where: { employeeId: 'TO-ADMIN' } })) ||
    (await prisma.user.findFirst({ where: { role: Role.ADMIN, storeId: store.id } }));

  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: 'Shop Admin',
        email,
        passwordHash,
        employeeId: 'TO-ADMIN',
        employeeBarcode: '10000001',
        role: Role.ADMIN,
        isActive: true,
        storeId: store.id
      }
    });
  } else {
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: {
        name: 'Shop Admin',
        email,
        passwordHash,
        employeeId: admin.employeeId || 'TO-ADMIN',
        role: Role.ADMIN,
        isActive: true,
        storeId: store.id
      }
    });
  }

  for (const permission of ALL_PERMISSIONS) {
    await prisma.userPermission.upsert({
      where: { userId_permission: { userId: admin.id, permission } },
      update: {},
      create: { userId: admin.id, permission }
    });
  }

  return prisma.user.findUnique({
    where: { id: admin.id },
    include: { permissions: true, store: true }
  });
}

export function isInitialAdminLogin(identifier: string, password: string) {
  const email = (process.env.INITIAL_ADMIN_EMAIL || '').toLowerCase().trim();
  const envPassword = process.env.INITIAL_ADMIN_PASSWORD || '';
  if (!email || !envPassword) return false;
  const id = identifier.trim().toLowerCase();
  return (
    password === envPassword &&
    (id === email || id === 'to-admin' || identifier.trim() === 'TO-ADMIN')
  );
}
