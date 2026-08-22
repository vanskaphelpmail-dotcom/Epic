import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ALL_PERMISSIONS, STAFF_POS_ONLY } from '../lib/permissions';
import { CATALOG, randomCost, randomStock } from './catalog';
import { seedDemoOperations } from './seed-demo';

const prisma = new PrismaClient();

const MANAGER_PERMS = [
  'DASHBOARD_VIEW',
  'POS_ACCESS',
  'POS_SELL',
  'POS_DISCOUNT',
  'PRODUCT_VIEW',
  'PRODUCT_CREATE',
  'PRODUCT_EDIT',
  'PRODUCT_BARCODE_PRINT',
  'INVENTORY_VIEW',
  'INVENTORY_ADJUST',
  'STOCK_REPORT_VIEW',
  'STOCK_REPORT_EXPORT',
  'SALES_VIEW',
  'SALES_REPORT_VIEW',
  'SALES_EXPORT',
  'ATTENDANCE_VIEW',
  'ATTENDANCE_CLOCK_IN',
  'ATTENDANCE_CLOCK_OUT',
  'CASH_RECONCILIATION',
  'CUSTOMER_VIEW',
  'ORDER_VIEW',
  'ORDER_PRINT',
  'DOCUMENT_VIEW',
  'DOCUMENT_UPLOAD',
  'REPORT_VIEW',
  'REPORT_EXPORT',
  'STAFF_VIEW',
  'STAFF_CREATE',
  'STAFF_EDIT',
  'PERMISSION_MANAGE',
  'COST_VIEW',
  'PROFIT_VIEW'
] as const;

const TEAM = [
  {
    name: 'Billing Manager',
    email: 'manager@theouds.local',
    employeeId: 'TO-2001',
    employeeBarcode: '20000001',
    password: 'Manager123!',
    permissions: MANAGER_PERMS
  },
  {
    name: 'POS Cashier Aisha',
    email: 'aisha@theouds.local',
    employeeId: 'TO-2002',
    employeeBarcode: '20000002',
    password: 'Staff123!',
    permissions: STAFF_POS_ONLY
  },
  {
    name: 'POS Cashier Omar',
    email: 'omar@theouds.local',
    employeeId: 'TO-2003',
    employeeBarcode: '20000003',
    password: 'Staff123!',
    permissions: STAFF_POS_ONLY
  },
  {
    name: 'Floor Associate Nora',
    email: 'nora@theouds.local',
    employeeId: 'TO-2004',
    employeeBarcode: '20000004',
    password: 'Staff123!',
    permissions: ['DASHBOARD_VIEW', 'PRODUCT_VIEW', 'SALES_VIEW', 'ATTENDANCE_CLOCK_IN', 'ATTENDANCE_CLOCK_OUT', 'CUSTOMER_VIEW']
  },
  {
    name: 'Stock Keeper Hasan',
    email: 'hasan@theouds.local',
    employeeId: 'TO-2005',
    employeeBarcode: '20000005',
    password: 'Staff123!',
    permissions: [
      'DASHBOARD_VIEW',
      'PRODUCT_VIEW',
      'PRODUCT_CREATE',
      'INVENTORY_VIEW',
      'INVENTORY_ADJUST',
      'STOCK_REPORT_VIEW',
      'STOCK_REPORT_EXPORT',
      'ATTENDANCE_CLOCK_IN',
      'ATTENDANCE_CLOCK_OUT',
      'COST_VIEW'
    ]
  }
];

const EXTRA_ADMINS = [
  {
    name: 'Shop Admin 2',
    email: 'admin2@theouds.co.uk',
    employeeId: 'TO-AD02',
    employeeBarcode: '10000002',
    password: 'AdminOuds2#'
  },
  {
    name: 'Shop Admin 3',
    email: 'admin3@theouds.co.uk',
    employeeId: 'TO-AD03',
    employeeBarcode: '10000003',
    password: 'AdminOuds3#'
  },
  {
    name: 'Shop Admin 4',
    email: 'admin4@theouds.co.uk',
    employeeId: 'TO-AD04',
    employeeBarcode: '10000004',
    password: 'AdminOuds4#'
  }
];

async function main() {
  const email = (process.env.INITIAL_ADMIN_EMAIL || '').toLowerCase().trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD || '';
  if (!email || !password) {
    throw new Error('INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are required for seed');
  }

  const store = await prisma.store.upsert({
    where: { code: 'STORE-001' },
    update: {
      name: 'The Ouds',
      address: '136A Woodville Road, CF24 4EE, Cardiff',
      phone: '+447454 045315',
      logoUrl: '/the-ouds-logo.png',
      currency: 'GBP',
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
    console.log(`Created admin ${email}`);
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
    console.log(`Updated admin ${email}`);
  }

  for (const permission of ALL_PERMISSIONS) {
    await prisma.userPermission.upsert({
      where: { userId_permission: { userId: admin.id, permission } },
      update: {},
      create: { userId: admin.id, permission }
    });
  }

  for (const member of TEAM) {
    const passwordHash = await bcrypt.hash(member.password, 12);
    const existing = await prisma.user.findUnique({ where: { email: member.email } });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, isActive: true, storeId: store.id, name: member.name, employeeId: member.employeeId }
      });
      continue;
    }
    await prisma.user.create({
      data: {
        name: member.name,
        email: member.email,
        passwordHash,
        employeeId: member.employeeId,
        employeeBarcode: member.employeeBarcode,
        role: Role.STAFF,
        isActive: true,
        storeId: store.id,
        permissions: {
          create: member.permissions.map((permission) => ({ permission }))
        }
      }
    });
    console.log(`Created team user ${member.email}`);
  }

  for (const extra of EXTRA_ADMINS) {
    const passwordHash = await bcrypt.hash(extra.password, 12);
    const existing =
      (await prisma.user.findUnique({ where: { email: extra.email } })) ||
      (await prisma.user.findUnique({ where: { employeeId: extra.employeeId } }));
    const row = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: extra.name,
            email: extra.email,
            passwordHash,
            employeeId: extra.employeeId,
            employeeBarcode: extra.employeeBarcode,
            role: Role.ADMIN,
            isActive: true,
            storeId: store.id
          }
        })
      : await prisma.user.create({
          data: {
            name: extra.name,
            email: extra.email,
            passwordHash,
            employeeId: extra.employeeId,
            employeeBarcode: extra.employeeBarcode,
            role: Role.ADMIN,
            isActive: true,
            storeId: store.id
          }
        });
    for (const permission of ALL_PERMISSIONS) {
      await prisma.userPermission.upsert({
        where: { userId_permission: { userId: row.id, permission } },
        update: {},
        create: { userId: row.id, permission }
      });
    }
    console.log(`Upserted extra admin ${extra.email}`);
  }

  const brandNames = [...new Set(CATALOG.map((i) => i.brand).filter(Boolean))];
  const categoryNames = [...new Set(CATALOG.map((i) => i.category).filter(Boolean))];
  for (const name of brandNames) {
    await prisma.catalogBrand.upsert({
      where: { storeId_name: { storeId: store.id, name } },
      update: { isActive: true },
      create: { storeId: store.id, name }
    });
  }
  for (const name of categoryNames) {
    await prisma.catalogCategory.upsert({
      where: { storeId_name: { storeId: store.id, name } },
      update: { isActive: true },
      create: { storeId: store.id, name }
    });
  }

  let index = 1;
  for (const item of CATALOG) {
    const sku = `TOU-${String(index).padStart(6, '0')}`;
    const barcode = String(49000000 + index);
    index += 1;
    const exists = await prisma.product.findUnique({ where: { sku } });
    const stockQuantity = randomStock(item.stockQuantity);
    const purchasePrice = item.purchasePrice ?? randomCost(item.sellingPrice);

    if (exists) {
      // Keep featured listings (cost / stock / image) in sync when re-seeding
      if (item.purchasePrice != null && item.image) {
        await prisma.product.update({
          where: { id: exists.id },
          data: {
            name: item.name,
            brand: item.brand,
            category: item.category,
            size: item.size,
            purchasePrice,
            sellingPrice: item.sellingPrice,
            stockQuantity,
            image: item.image,
            isActive: true
          }
        });
      }
      continue;
    }

    await prisma.product.create({
      data: {
        name: item.name,
        sku,
        barcode,
        brand: item.brand,
        category: item.category,
        size: item.size,
        purchasePrice,
        sellingPrice: item.sellingPrice,
        stockQuantity,
        minimumStock: stockQuantity === 0 ? 5 : Math.max(3, Math.floor(stockQuantity * 0.2)),
        image: item.image,
        storeId: store.id,
        isActive: true
      }
    });
  }

  // Sample documents / payroll rows for admin modules
  const docCount = await prisma.document.count();
  if (docCount === 0) {
    await prisma.document.createMany({
      data: [
        {
          storeId: store.id,
          uploadedById: admin.id,
          title: 'Supplier delivery note - Lattafa',
          category: 'DELIVERY_NOTE',
          mimeType: 'application/pdf',
          sizeBytes: 12000
        },
        {
          storeId: store.id,
          uploadedById: admin.id,
          title: 'Shop lease summary',
          category: 'LETTER',
          mimeType: 'application/pdf',
          sizeBytes: 18000
        }
      ]
    });
  }

  await seedDemoOperations(prisma, store.id);

  console.log(`Seeded ${CATALOG.length} catalog products and team users.`);
  console.log('Seed complete.');
  console.log(`Store: ${store.code}`);
  console.log(`Admin login: ${email}`);
  console.log('Demo: 7-day UK sales + attendance, monthly payroll full/partial.');
  console.log('Reports: Inventory/Sales/Attendance/Salary Excel downloads use Last 7 days / This month filters.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
