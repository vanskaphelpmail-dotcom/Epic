import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { ALL_PERMISSIONS, STAFF_POS_ONLY } from '../lib/permissions';

config();

const prisma = new PrismaClient();

const MANAGER_PERMS = [
  'DASHBOARD_VIEW', 'POS_ACCESS', 'POS_SELL', 'POS_DISCOUNT', 'PRODUCT_VIEW', 'PRODUCT_CREATE',
  'PRODUCT_EDIT', 'PRODUCT_BARCODE_PRINT', 'INVENTORY_VIEW', 'INVENTORY_ADJUST', 'STOCK_REPORT_VIEW',
  'STOCK_REPORT_EXPORT', 'SALES_VIEW', 'SALES_REPORT_VIEW', 'SALES_EXPORT', 'ATTENDANCE_VIEW',
  'ATTENDANCE_CLOCK_IN', 'ATTENDANCE_CLOCK_OUT', 'CASH_RECONCILIATION', 'CUSTOMER_VIEW', 'ORDER_VIEW',
  'ORDER_PRINT', 'DOCUMENT_VIEW', 'DOCUMENT_UPLOAD', 'REPORT_VIEW', 'REPORT_EXPORT', 'STAFF_VIEW',
  'STAFF_CREATE', 'STAFF_EDIT', 'PERMISSION_MANAGE', 'COST_VIEW', 'PROFIT_VIEW'
] as const;

async function upsertUser(input: {
  name: string;
  email: string;
  employeeId: string;
  employeeBarcode: string;
  password: string;
  role: Role;
  storeId: string;
  permissions?: readonly string[];
}) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const existing =
    (await prisma.user.findUnique({ where: { email: input.email } })) ||
    (await prisma.user.findUnique({ where: { employeeId: input.employeeId } }));
  const row = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          employeeId: input.employeeId,
          employeeBarcode: input.employeeBarcode,
          role: input.role,
          isActive: true,
          storeId: input.storeId
        }
      })
    : await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          employeeId: input.employeeId,
          employeeBarcode: input.employeeBarcode,
          role: input.role,
          isActive: true,
          storeId: input.storeId
        }
      });
  if (input.role === Role.ADMIN) {
    for (const permission of ALL_PERMISSIONS) {
      await prisma.userPermission.upsert({
        where: { userId_permission: { userId: row.id, permission } },
        update: {},
        create: { userId: row.id, permission }
      });
    }
  } else if (input.permissions?.length && !existing) {
    await prisma.userPermission.createMany({
      data: input.permissions.map((permission) => ({ userId: row.id, permission })),
      skipDuplicates: true
    });
  }
  console.log(`${existing ? 'Updated' : 'Created'} ${input.email} (${input.employeeId})`);
}

async function main() {
  const store = await prisma.store.findFirst({ where: { code: 'STORE-001' } });
  if (!store) throw new Error('Store STORE-001 not found');
  const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'admin@theouds.co.uk').toLowerCase();
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'TheOuds#2026';

  await upsertUser({
    name: 'Shop Admin',
    email: adminEmail,
    employeeId: 'TO-ADMIN',
    employeeBarcode: '10000001',
    password: adminPassword.replace(/^"|"$/g, ''),
    role: Role.ADMIN,
    storeId: store.id
  });

  await upsertUser({
    name: 'Billing Manager',
    email: 'manager@theouds.local',
    employeeId: 'TO-2001',
    employeeBarcode: '20000001',
    password: 'Manager123!',
    role: Role.STAFF,
    storeId: store.id,
    permissions: MANAGER_PERMS
  });
  await upsertUser({
    name: 'POS Cashier Aisha',
    email: 'aisha@theouds.local',
    employeeId: 'TO-2002',
    employeeBarcode: '20000002',
    password: 'Staff123!',
    role: Role.STAFF,
    storeId: store.id,
    permissions: STAFF_POS_ONLY
  });
  await upsertUser({
    name: 'POS Cashier Omar',
    email: 'omar@theouds.local',
    employeeId: 'TO-2003',
    employeeBarcode: '20000003',
    password: 'Staff123!',
    role: Role.STAFF,
    storeId: store.id,
    permissions: STAFF_POS_ONLY
  });
  await upsertUser({
    name: 'Floor Associate Nora',
    email: 'nora@theouds.local',
    employeeId: 'TO-2004',
    employeeBarcode: '20000004',
    password: 'Staff123!',
    role: Role.STAFF,
    storeId: store.id,
    permissions: ['DASHBOARD_VIEW', 'PRODUCT_VIEW', 'SALES_VIEW', 'ATTENDANCE_CLOCK_IN', 'ATTENDANCE_CLOCK_OUT', 'CUSTOMER_VIEW']
  });
  await upsertUser({
    name: 'Stock Keeper Hasan',
    email: 'hasan@theouds.local',
    employeeId: 'TO-2005',
    employeeBarcode: '20000005',
    password: 'Staff123!',
    role: Role.STAFF,
    storeId: store.id,
    permissions: [
      'DASHBOARD_VIEW', 'PRODUCT_VIEW', 'PRODUCT_CREATE', 'INVENTORY_VIEW', 'INVENTORY_ADJUST',
      'STOCK_REPORT_VIEW', 'STOCK_REPORT_EXPORT', 'ATTENDANCE_CLOCK_IN', 'ATTENDANCE_CLOCK_OUT', 'COST_VIEW'
    ]
  });

  for (const extra of [
    { name: 'Shop Admin 2', email: 'admin2@theouds.co.uk', employeeId: 'TO-AD02', employeeBarcode: '10000002', password: 'AdminOuds2#' },
    { name: 'Shop Admin 3', email: 'admin3@theouds.co.uk', employeeId: 'TO-AD03', employeeBarcode: '10000003', password: 'AdminOuds3#' },
    { name: 'Shop Admin 4', email: 'admin4@theouds.co.uk', employeeId: 'TO-AD04', employeeBarcode: '10000004', password: 'AdminOuds4#' }
  ]) {
    await upsertUser({ ...extra, role: Role.ADMIN, storeId: store.id });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
