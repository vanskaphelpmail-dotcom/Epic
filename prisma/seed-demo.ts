import { PaymentMethod, PrismaClient, Role } from '@prisma/client';
import { CATALOG, type CatalogProduct } from './catalog';
import { createBrand, createCategory } from '../services/catalog.service';

/** Convert a Europe/London wall-clock time to a UTC Date. */
export function londonToUtc(parts: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
}) {
  const hour = parts.hour ?? 0;
  const minute = parts.minute ?? 0;
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, 0);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const map = Object.fromEntries(
    formatter
      .formatToParts(new Date(utcGuess))
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value])
  );
  const asLondon = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second || 0)
  );
  return new Date(utcGuess - (asLondon - utcGuess));
}

function londonTodayParts() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function addDays(parts: { year: number; month: number; day: number }, delta: number) {
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day + delta);
  const d = new Date(utc);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const DEMO_MARKER = 'DEMO-7D';

async function upsertFeaturedProduct(
  prisma: PrismaClient,
  storeId: string,
  item: CatalogProduct,
  skuHint: string,
  barcodeHint: string
) {
  const name = item.name;
  const brand = item.brand;
  const category = item.category;
  const sellingPrice = item.sellingPrice;
  const purchasePrice = item.purchasePrice ?? round2(item.sellingPrice * 0.42);
  const stockQuantity = item.stockQuantity ?? 10;
  const image = item.image;
  const size = item.size || '100ml';

  try {
    await createBrand(storeId, brand);
    await createCategory(storeId, category);
  } catch {
    /* catalog may use settings fallback */
  }

  const existing =
    (await prisma.product.findFirst({
      where: { storeId, name }
    })) ||
    (await prisma.product.findFirst({
      where: { storeId, barcode: barcodeHint }
    })) ||
    (await prisma.product.findFirst({
      where: { storeId, sku: skuHint }
    })) ||
    (await prisma.product.findFirst({
      where: {
        storeId,
        name: { contains: name.split(' ').slice(0, 2).join(' ') }
      }
    }));

  if (existing) {
    return prisma.product.update({
      where: { id: existing.id },
      data: {
        name,
        brand,
        category,
        size,
        sellingPrice,
        purchasePrice,
        stockQuantity,
        image: image || existing.image,
        isActive: true,
        minimumStock: 5
      }
    });
  }

  const skuTaken = await prisma.product.findUnique({ where: { sku: skuHint } });
  const codeTaken = await prisma.product.findUnique({ where: { barcode: barcodeHint } });

  return prisma.product.create({
    data: {
      name,
      sku: skuTaken ? `TOU-${Date.now().toString().slice(-6)}` : skuHint,
      barcode: codeTaken ? `49${String(Date.now()).slice(-6)}` : barcodeHint,
      brand,
      category,
      size,
      sellingPrice,
      purchasePrice,
      stockQuantity,
      minimumStock: 5,
      image,
      storeId,
      isActive: true
    }
  });
}

/** Featured listings with fixed cost, sell price, stock, and image. */
export async function ensureFeaturedProducts(prisma: PrismaClient, storeId: string) {
  const featured = CATALOG.filter(
    (p) => p.purchasePrice != null && p.stockQuantity != null && p.image
  );
  const hints: Record<string, { sku: string; barcode: string }> = {
    'Bujairami Non Stop 100ml Extrait De Parfum Bujairami Sydney': {
      sku: 'TOU-000017',
      barcode: '49000017'
    },
    'Ansaam Gold Perfume 100ml EDP Lattafa Pride': {
      sku: 'TOU-000001',
      barcode: '49000001'
    }
  };

  const results = [];
  for (const item of featured) {
    const hint = hints[item.name] || {
      sku: `TOU-${item.name.slice(0, 6).replace(/\s/g, '').toUpperCase()}`,
      barcode: `49${String(Math.abs(item.name.length * 1000 + Math.floor(item.sellingPrice * 100))).padStart(6, '0')}`
    };
    results.push(await upsertFeaturedProduct(prisma, storeId, item, hint.sku, hint.barcode));
  }
  return results;
}

/** @deprecated use ensureFeaturedProducts */
export async function ensureNonStopProduct(prisma: PrismaClient, storeId: string) {
  const rows = await ensureFeaturedProducts(prisma, storeId);
  return (
    rows.find((p) => p.name.includes('Non Stop')) ||
    rows[0] ||
    upsertFeaturedProduct(
      prisma,
      storeId,
      {
        name: 'Bujairami Non Stop 100ml Extrait De Parfum Bujairami Sydney',
        brand: 'Non Stop',
        category: "Men's Perfume",
        size: '100ml',
        sellingPrice: 52.95,
        purchasePrice: 22.5,
        stockQuantity: 20,
        image: '/products/bujairami-non-stop.png'
      },
      'TOU-NONSTOP',
      '49000028'
    )
  );
}

/**
 * Seeds 7 days of UK-time attendance + sales for team users, and monthly payroll
 * (full / partial). Idempotent via DEMO-7D notes / invoice prefix.
 */
export async function seedDemoOperations(prisma: PrismaClient, storeId: string) {
  await ensureFeaturedProducts(prisma, storeId);
  const users = await prisma.user.findMany({
    where: { storeId, isActive: true },
    orderBy: { employeeId: 'asc' }
  });
  const admin = users.find((u) => u.role === Role.ADMIN);
  const manager = users.find((u) => u.email === 'manager@theouds.local');
  const aisha = users.find((u) => u.email === 'aisha@theouds.local');
  const omar = users.find((u) => u.email === 'omar@theouds.local');
  const nora = users.find((u) => u.email === 'nora@theouds.local');
  const hasan = users.find((u) => u.email === 'hasan@theouds.local');

  const sellers = [aisha, omar, admin, manager].filter(Boolean) as typeof users;
  const clockUsers = [admin, manager, aisha, omar, nora, hasan].filter(Boolean) as typeof users;

  const products = await prisma.product.findMany({
    where: { storeId, isActive: true, stockQuantity: { gt: 0 } },
    take: 12,
    orderBy: { name: 'asc' }
  });
  if (!products.length || !sellers.length) {
    console.log('Demo seed skipped: need products and staff users');
    return;
  }

  const today = londonTodayParts();
  let invoiceSeq = 9000;

  // --- Attendance: last 7 London days (incl. today) ---
  {
    const existingDemoSales = await prisma.sale.count({
      where: { storeId, notes: { contains: DEMO_MARKER } }
    });
    if (existingDemoSales > 0) {
      console.log('Demo 7-day sales/attendance already present — skipping recreate');
    } else {
    for (let ago = 6; ago >= 0; ago -= 1) {
      const dayParts = addDays(today, -ago);
      const dayStart = londonToUtc({ ...dayParts, hour: 0, minute: 0 });

      for (const user of clockUsers) {
        // Nora works shorter days; Hasan mid shift; cashiers + admin full retail day
        const isShort = user.email === 'nora@theouds.local';
        const inHour = user.email === 'hasan@theouds.local' ? 10 : 9;
        const outHour = isShort ? 15 : user.email === 'hasan@theouds.local' ? 18 : 17;
        const inMin = user.email?.includes('aisha') ? 5 : user.email?.includes('omar') ? 12 : 0;
        const outMin = user.role === Role.ADMIN ? 45 : isShort ? 30 : 15;

        const clockIn = londonToUtc({ ...dayParts, hour: inHour, minute: inMin });
        const clockOut = londonToUtc({ ...dayParts, hour: outHour, minute: outMin });
        const workMinutes = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000);
        const openingCash = 150 + (6 - ago) * 10;
        const closingCash = openingCash + 40 + ago * 5;

        const existing = await prisma.attendance.findFirst({
          where: { userId: user.id, storeId, date: dayStart }
        });
        if (existing) continue;

        const attendance = await prisma.attendance.create({
          data: {
            userId: user.id,
            storeId,
            date: dayStart,
            clockIn,
            clockOut,
            workMinutes,
            openingCash,
            closingCash,
            expectedCash: closingCash,
            cashDiff: 0,
            notes: `${DEMO_MARKER} UK shift`
          }
        });

        await prisma.cashSession.create({
          data: {
            storeId,
            employeeId: user.id,
            attendanceId: attendance.id,
            openingCash,
            closingCash,
            expectedCash: closingCash,
            cashDifference: 0,
            status: 'CLOSED',
            openedAt: clockIn,
            closedAt: clockOut,
            notes: DEMO_MARKER
          }
        });
      }

      // --- Sales for this day (admin + cashiers + manager) ---
      const daySellers = sellers.filter((_, idx) => ago % 2 === 0 || idx < 3);
      for (const staff of daySellers) {
        const saleCount = staff.role === Role.ADMIN ? 1 : 1 + (ago % 2);
        for (let s = 0; s < saleCount; s += 1) {
          invoiceSeq += 1;
          const invoiceNumber = `INV-${dayParts.year}-D${String(invoiceSeq).padStart(4, '0')}`;
          const exists = await prisma.sale.findUnique({ where: { invoiceNumber } });
          if (exists) continue;

          const product = products[(ago + s + sellers.indexOf(staff)) % products.length];
          const qty = 1 + ((ago + s) % 2);
          const unit = product.sellingPrice;
          // VAT-inclusive shelf prices (UK)
          const taxRate = 0.2;
          const total = round2(unit * qty);
          const tax = round2((total * taxRate) / (1 + taxRate));
          const net = round2(total - tax);
          const saleHour = 11 + s * 2 + (staff.email?.includes('omar') ? 1 : 0);
          const saleDate = londonToUtc({ ...dayParts, hour: saleHour, minute: 15 + s * 7 });
          const method: PaymentMethod =
            s % 3 === 0 ? 'CASH' : s % 3 === 1 ? 'CARD' : 'BANK_TRANSFER';
          const idempotencyKey = `${DEMO_MARKER}-${invoiceNumber}`;

          const keyTaken = await prisma.sale.findUnique({ where: { idempotencyKey } });
          if (keyTaken) continue;

          try {
            await prisma.sale.create({
              data: {
                invoiceNumber,
                storeId,
                staffId: staff.id,
                subtotal: net,
                discount: 0,
                taxRate,
                tax,
                total,
                paymentMethod: method,
                paymentStatus: 'PAID',
                status: 'COMPLETED',
                cashReceived: total,
                changeGiven: 0,
                currency: 'GBP',
                idempotencyKey,
                notes: `${DEMO_MARKER} · ${staff.name}`,
                saleDate,
                createdAt: saleDate,
                items: {
                  create: [
                    {
                      productId: product.id,
                      name: product.name,
                      sku: product.sku,
                      barcode: product.barcode,
                      quantity: qty,
                      sellingPrice: unit,
                      lineTotal: total
                    }
                  ]
                }
              }
            });
          } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === 'P2002') continue;
            throw err;
          }
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        storeId,
        userId: admin?.id,
        action: 'DEMO_SEED',
        entity: 'Store',
        entityId: storeId,
        newData: {
          marker: DEMO_MARKER,
          days: 7,
          timezone: 'Europe/London',
          note: '7-day sales + attendance demo data'
        }
      }
    });

      console.log('Seeded 7-day UK attendance, cash sessions, and sales for team users');
    }
  }

  // --- Monthly payroll: full + partial ---
  const monthStartParts = { year: today.year, month: today.month, day: 1 };
  const monthEndParts = addDays(
    { year: today.year, month: today.month + 1, day: 1 },
    -1
  );
  const periodStart = londonToUtc({ ...monthStartParts, hour: 0, minute: 0 });
  const periodEnd = londonToUtc({ ...monthEndParts, hour: 23, minute: 59 });

  const payrollPlan: {
    email?: string;
    role?: Role;
    base: number;
    paidRatio: number; // 1 = full, 0.5 = partial, 0 = unpaid/pending
    status?: 'PENDING' | 'PAID' | 'PARTIAL' | 'UNPAID';
  }[] = [
    { email: 'aisha@theouds.local', base: 1680, paidRatio: 1 }, // full month
    { email: 'omar@theouds.local', base: 1600, paidRatio: 0.5 }, // partial
    { email: 'nora@theouds.local', base: 1520, paidRatio: 0, status: 'PENDING' }, // dummy pending
    { email: 'hasan@theouds.local', base: 1800, paidRatio: 1 }, // full
    { email: 'manager@theouds.local', base: 2400, paidRatio: 0.6 }, // partial
    { role: Role.ADMIN, base: 3000, paidRatio: 1 } // admin full
  ];

  for (const plan of payrollPlan) {
    const user = plan.email
      ? users.find((u) => u.email === plan.email)
      : users.find((u) => u.role === plan.role);
    if (!user) continue;

    const existing = await prisma.salaryRecord.findFirst({
      where: {
        userId: user.id,
        storeId,
        periodStart,
        notes: { contains: DEMO_MARKER }
      }
    });

    // Hours from seeded attendance this month
    const att = await prisma.attendance.findMany({
      where: {
        userId: user.id,
        storeId,
        date: { gte: periodStart, lte: periodEnd }
      }
    });
    const workingDays = att.length || 20;
    const workingHours = round2(
      att.reduce((s, a) => s + (a.workMinutes || 0), 0) / 60 || workingDays * 8
    );
    const base = plan.base;
    const calculated = base;
    const paid = round2(base * plan.paidRatio);
    const due = round2(Math.max(0, calculated - paid));
    const status =
      plan.status ||
      (due <= 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID');
    const statusNote =
      status === 'PENDING'
        ? 'Pending payment'
        : plan.paidRatio >= 1
          ? 'Paid in full'
          : plan.paidRatio > 0
            ? 'Partial payment'
            : 'Unpaid';

    if (existing) {
      // Keep demo visible: bump Nora (and any marked) to PENDING with dummy amounts
      if (plan.status === 'PENDING') {
        await prisma.salaryRecord.update({
          where: { id: existing.id },
          data: {
            workingDays,
            workingHours,
            baseSalary: base,
            calculatedSalary: calculated,
            paidAmount: 0,
            dueAmount: calculated,
            paymentStatus: 'PENDING',
            notes: `${DEMO_MARKER} · ${statusNote} · UK month`
          }
        });
      }
      continue;
    }

    await prisma.salaryRecord.create({
      data: {
        userId: user.id,
        storeId,
        periodStart,
        periodEnd,
        workingDays,
        workingHours,
        baseSalary: base,
        calculatedSalary: calculated,
        paidAmount: paid,
        dueAmount: due,
        paymentStatus: status,
        notes: `${DEMO_MARKER} · ${statusNote} · UK month`
      }
    });
  }

  // Weekly dummy pending salary (current UK week) — shows on Payroll create/list
  if (nora) {
    const day = new Date(
      Date.UTC(today.year, today.month - 1, today.day, 12, 0, 0)
    ).getUTCDay(); // 0 Sun … 6 Sat
    const offsetToMon = day === 0 ? -6 : 1 - day;
    const weekStartParts = addDays(today, offsetToMon);
    const weekEndParts = addDays(weekStartParts, 6);
    const weekStart = londonToUtc({ ...weekStartParts, hour: 0, minute: 0 });
    const weekEnd = londonToUtc({ ...weekEndParts, hour: 23, minute: 59 });

    const weekAtt = await prisma.attendance.findMany({
      where: {
        userId: nora.id,
        storeId,
        date: { gte: weekStart, lte: weekEnd }
      }
    });
    const weekDays = weekAtt.length || 5;
    const weekHours = round2(
      weekAtt.reduce((s, a) => s + (a.workMinutes || 0), 0) / 60 || weekDays * 8
    );
    const weekBase = 400;
    const weekCalc = weekBase;

    const weekExisting = await prisma.salaryRecord.findFirst({
      where: {
        userId: nora.id,
        storeId,
        periodStart: weekStart,
        notes: { contains: DEMO_MARKER }
      }
    });

    if (weekExisting) {
      await prisma.salaryRecord.update({
        where: { id: weekExisting.id },
        data: {
          periodEnd: weekEnd,
          workingDays: weekDays,
          workingHours: weekHours,
          baseSalary: weekBase,
          calculatedSalary: weekCalc,
          paidAmount: 0,
          dueAmount: weekCalc,
          paymentStatus: 'PENDING',
          notes: `${DEMO_MARKER} · Pending weekly salary · dummy`
        }
      });
    } else {
      await prisma.salaryRecord.create({
        data: {
          userId: nora.id,
          storeId,
          periodStart: weekStart,
          periodEnd: weekEnd,
          workingDays: weekDays,
          workingHours: weekHours,
          baseSalary: weekBase,
          calculatedSalary: weekCalc,
          paidAmount: 0,
          dueAmount: weekCalc,
          paymentStatus: 'PENDING',
          notes: `${DEMO_MARKER} · Pending weekly salary · dummy`
        }
      });
    }
  }

  console.log('Seeded monthly payroll (full / partial / pending) + weekly pending for Nora');
}

/** Ensures at least one PENDING dummy salary exists (Nora weekly) for Payroll UI demos. */
export async function ensurePendingDemoSalaries(prisma: PrismaClient, storeId: string) {
  const nora = await prisma.user.findFirst({
    where: { storeId, email: 'nora@theouds.local', isActive: true }
  });
  if (!nora) return null;

  const today = londonTodayParts();
  const day = new Date(
    Date.UTC(today.year, today.month - 1, today.day, 12, 0, 0)
  ).getUTCDay();
  const offsetToMon = day === 0 ? -6 : 1 - day;
  const weekStartParts = addDays(today, offsetToMon);
  const weekEndParts = addDays(weekStartParts, 6);
  const weekStart = londonToUtc({ ...weekStartParts, hour: 0, minute: 0 });
  const weekEnd = londonToUtc({ ...weekEndParts, hour: 23, minute: 59 });

  const weekAtt = await prisma.attendance.findMany({
    where: {
      userId: nora.id,
      storeId,
      date: { gte: weekStart, lte: weekEnd }
    }
  });
  const weekDays = weekAtt.length || 5;
  const weekHours = round2(
    weekAtt.reduce((s, a) => s + (a.workMinutes || 0), 0) / 60 || weekDays * 8
  );
  const weekBase = 400;

  const weekExisting = await prisma.salaryRecord.findFirst({
    where: {
      userId: nora.id,
      storeId,
      periodStart: weekStart
    }
  });

  if (weekExisting) {
    return prisma.salaryRecord.update({
      where: { id: weekExisting.id },
      data: {
        periodEnd: weekEnd,
        workingDays: weekDays,
        workingHours: weekHours,
        baseSalary: weekBase,
        calculatedSalary: weekBase,
        paidAmount: 0,
        dueAmount: weekBase,
        paymentStatus: 'PENDING',
        notes: `${DEMO_MARKER} · Pending weekly salary · dummy`
      }
    });
  }

  return prisma.salaryRecord.create({
    data: {
      userId: nora.id,
      storeId,
      periodStart: weekStart,
      periodEnd: weekEnd,
      workingDays: weekDays,
      workingHours: weekHours,
      baseSalary: weekBase,
      calculatedSalary: weekBase,
      paidAmount: 0,
      dueAmount: weekBase,
      paymentStatus: 'PENDING',
      notes: `${DEMO_MARKER} · Pending weekly salary · dummy`
    }
  });
}
