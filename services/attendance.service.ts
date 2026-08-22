import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { roundMoney } from '@/lib/money';
import { writeAudit } from '@/services/audit.service';
import { notifyAdmins } from '@/services/notify.service';
import {
  DEFAULT_GRACE_MINUTES,
  DEFAULT_SHIFT_END,
  DEFAULT_SHIFT_START,
  evaluateClockIn,
  evaluateClockOut
} from '@/lib/attendance-rules';

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getShiftFor(employeeId: string, at: Date) {
  const weekday = at.getDay();
  const shift = await prisma.shiftSchedule.findFirst({
    where: { employeeId, weekday, isActive: true }
  });
  return {
    startMinutes: shift?.startMinutes ?? DEFAULT_SHIFT_START,
    endMinutes: shift?.endMinutes ?? DEFAULT_SHIFT_END,
    graceMinutes: shift?.lateGraceMinutes ?? DEFAULT_GRACE_MINUTES
  };
}

async function findEmployee(identifier: string) {
  const employee = await prisma.user.findFirst({
    where: {
      OR: [
        { employeeId: identifier },
        { employeeBarcode: identifier },
        { id: identifier },
        { email: identifier.toLowerCase() }
      ],
      role: { in: ['ADMIN', 'STAFF'] }
    }
  });
  if (!employee) throw new AppError('NOT_FOUND', 'Employee not found', 404);
  if (!employee.isActive) throw new AppError('FORBIDDEN', 'Employee is inactive', 403);
  if (!employee.storeId) throw new AppError('VALIDATION_ERROR', 'Employee has no assigned store');
  return employee;
}

/** Last known till balance for store (and optionally employee). */
export async function getCurrentCashBalance(storeId: string, employeeId?: string) {
  const open = await prisma.cashSession.findFirst({
    where: {
      storeId,
      status: 'OPEN',
      ...(employeeId ? { employeeId } : {})
    },
    orderBy: { openedAt: 'desc' },
    include: { transactions: true }
  });

  if (open) {
    const txs = open.transactions || [];
    const cashSales = txs.filter((t) => t.type === 'SALE').reduce((s, t) => s + t.amount, 0);
    const cashIn = txs.filter((t) => t.type === 'CASH_IN').reduce((s, t) => s + t.amount, 0);
    const refunds = txs.filter((t) => t.type === 'REFUND').reduce((s, t) => s + t.amount, 0);
    const cashOut = txs.filter((t) => ['CASH_OUT', 'EXPENSE'].includes(t.type)).reduce((s, t) => s + t.amount, 0);
    const currentBalance = roundMoney(open.openingCash + cashSales + cashIn - refunds - cashOut);
    return {
      source: 'OPEN_SESSION' as const,
      currentBalance,
      openingCash: open.openingCash,
      sessionId: open.id,
      employeeId: open.employeeId
    };
  }

  const lastClosed = await prisma.cashSession.findFirst({
    where: {
      storeId,
      status: 'CLOSED',
      ...(employeeId ? { employeeId } : {})
    },
    orderBy: { closedAt: 'desc' }
  });

  const currentBalance = roundMoney(lastClosed?.closingCash ?? 0);
  return {
    source: lastClosed ? ('LAST_CLOSING' as const) : ('NEW' as const),
    currentBalance,
    openingCash: currentBalance,
    sessionId: lastClosed?.id || null,
    employeeId: lastClosed?.employeeId || employeeId || null
  };
}

export async function getAttendanceStatus(identifier: string) {
  const employee = await findEmployee(identifier);
  const open = await prisma.attendance.findFirst({
    where: { userId: employee.id, clockIn: { not: null }, clockOut: null },
    include: { cashSession: true }
  });
  const balance = await getCurrentCashBalance(employee.storeId!);
  const day = startOfDay();
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);
  const todaySales = await prisma.sale.aggregate({
    where: {
      staffId: employee.id,
      status: { not: 'VOID' },
      saleDate: { gte: day, lte: dayEnd }
    },
    _sum: { total: true },
    _count: true
  });
  const formatTime = (d?: Date | null) =>
    d ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null;
  return {
    employee: {
      id: employee.id,
      name: employee.name,
      employeeId: employee.employeeId,
      storeId: employee.storeId
    },
    isClockedIn: !!open,
    attendanceId: open?.id || null,
    clockIn: formatTime(open?.clockIn),
    clockOut: formatTime(open?.clockOut),
    clockInAt: open?.clockIn?.toISOString() || null,
    todaySaleCount: todaySales._count || 0,
    todaySaleTotal: roundMoney(todaySales._sum.total || 0),
    currentBalance: balance.currentBalance,
    tillCash: balance.currentBalance,
    balanceSource: balance.source,
    suggestedOpeningCash: balance.currentBalance
  };
}

export async function clockIn(input: {
  identifier: string;
  openingCash?: number;
  storeId?: string;
  actorId?: string;
  notes?: string;
}) {
  const employee = await findEmployee(input.identifier);
  if (input.storeId && employee.storeId !== input.storeId) {
    throw new AppError('FORBIDDEN', 'Employee cannot clock into this store', 403);
  }

  const day = startOfDay();
  const open = await prisma.attendance.findFirst({
    where: { userId: employee.id, clockIn: { not: null }, clockOut: null }
  });
  if (open) throw new AppError('DUPLICATE_ATTENDANCE', 'Employee already has an open attendance session');

    const firstOfDay = await prisma.attendance.findFirst({
      where: { storeId: employee.storeId!, date: day, clockIn: { not: null } },
      orderBy: { clockIn: 'asc' }
    });
    const isFirstClockIn = !firstOfDay;
    const balance = await getCurrentCashBalance(employee.storeId!, employee.id);
    const openingCash = isFirstClockIn
      ? (input.openingCash != null ? Number(input.openingCash) : balance.currentBalance)
      : balance.currentBalance;
    if (!(openingCash >= 0) || Number.isNaN(openingCash)) {
      throw new AppError('VALIDATION_ERROR', 'Opening cash / current balance is required');
    }

  const result = await prisma.$transaction(async (tx) => {
    const clockInAt = new Date();
    const shift = await getShiftFor(employee.id, clockInAt);
    const inn = evaluateClockIn(clockInAt, shift.startMinutes, shift.graceMinutes);
    const attendance = await tx.attendance.create({
      data: {
        userId: employee.id,
        storeId: employee.storeId!,
        date: day,
        clockIn: clockInAt,
        openingCash,
        lateMinutes: inn.lateMinutes,
        notes: input.notes || `Carried balance ${openingCash}`
      }
    });

    const session = await tx.cashSession.create({
      data: {
        storeId: employee.storeId!,
        employeeId: employee.id,
        attendanceId: attendance.id,
        openingCash,
        status: 'OPEN',
        notes: input.notes || 'Opening with current till balance'
      }
    });

    await tx.cashTransaction.create({
      data: {
        storeId: employee.storeId!,
        sessionId: session.id,
        userId: employee.id,
        type: 'OPENING_BALANCE',
        amount: openingCash,
        notes:
          balance.source === 'NEW'
            ? 'Initial joining balance'
            : 'Opening cash from previous closing balance'
      }
    });

    return { attendance, session, employee };
  });

  await writeAudit({
    userId: input.actorId || employee.id,
    storeId: employee.storeId,
    action: 'ATTENDANCE_CLOCK_IN',
    entity: 'Attendance',
    entityId: result.attendance.id,
    newData: { openingCash, carriedFrom: balance.source, employeeId: employee.employeeId }
  });
  await notifyAdmins({
    storeId: employee.storeId,
    title: 'Employee clock in',
    message: `${employee.name} clocked in`,
    type: 'CLOCK_IN'
  });

  return {
    ...result,
    currentBalance: openingCash,
    suggestedOpeningCash: openingCash,
    balanceSource: balance.source
  };
}

export async function clockOut(input: {
  identifier: string;
  closingCash?: number;
  storeId?: string;
  actorId?: string;
  notes?: string;
}) {
  const employee = await findEmployee(input.identifier);
  const attendance = await prisma.attendance.findFirst({
    where: { userId: employee.id, clockIn: { not: null }, clockOut: null },
    include: { cashSession: true }
  });
  if (!attendance?.cashSession) {
    throw new AppError('INVALID_ATTENDANCE', 'No open attendance/cash session found');
  }

  const session = attendance.cashSession;
  const txs = await prisma.cashTransaction.findMany({ where: { sessionId: session.id } });
  const cashSales = txs.filter((t) => t.type === 'SALE').reduce((s, t) => s + t.amount, 0);
  const cashIn = txs.filter((t) => t.type === 'CASH_IN').reduce((s, t) => s + t.amount, 0);
  const refunds = txs.filter((t) => t.type === 'REFUND').reduce((s, t) => s + t.amount, 0);
  const cashOut = txs.filter((t) => ['CASH_OUT', 'EXPENSE'].includes(t.type)).reduce((s, t) => s + t.amount, 0);
  const expectedCash = roundMoney(session.openingCash + cashSales + cashIn - refunds - cashOut);

  // Default closing cash to expected/current balance so balance carries forward.
  const closingCash =
    input.closingCash != null ? Number(input.closingCash) : expectedCash;
  if (!(closingCash >= 0) || Number.isNaN(closingCash)) {
    throw new AppError('VALIDATION_ERROR', 'Closing cash is required');
  }
  const cashDifference = roundMoney(closingCash - expectedCash);

  const updated = await prisma.$transaction(async (tx) => {
    const clockOutAt = new Date();
    const workMinutes = Math.round((clockOutAt.getTime() - attendance.clockIn!.getTime()) / 60000);
    const shift = await getShiftFor(employee.id, attendance.clockIn || clockOutAt);
    const inn = evaluateClockIn(attendance.clockIn, shift.startMinutes, shift.graceMinutes);
    const out = evaluateClockOut(clockOutAt, shift.endMinutes);
    const hourly = await prisma.salaryRecord.findFirst({
      where: { userId: employee.id },
      orderBy: { periodEnd: 'desc' }
    });
    const expectedHours = Number(hourly?.workingHours || 40) > 0 ? 40 : 40;
    const rate = hourly && hourly.baseSalary
      ? Number(hourly.baseSalary) / Math.max(1, expectedHours)
      : 0;
    const salaryDeduction = roundMoney((Number(inn.deductibleLate || 0) / 60) * rate);

    const closedAttendance = await tx.attendance.update({
      where: { id: attendance.id },
      data: {
        clockOut: clockOutAt,
        workMinutes,
        closingCash,
        expectedCash,
        cashDiff: cashDifference,
        lateMinutes: inn.lateMinutes,
        earlyMinutes: out.earlyMinutes,
        salaryDeduction,
        notes: input.notes || attendance.notes
      }
    });

    const closedSession = await tx.cashSession.update({
      where: { id: session.id },
      data: {
        closingCash,
        expectedCash,
        cashDifference,
        status: 'CLOSED',
        closedAt: clockOutAt,
        notes: input.notes
      }
    });

    await tx.cashTransaction.create({
      data: {
        storeId: employee.storeId!,
        sessionId: session.id,
        userId: employee.id,
        type: 'CLOSING_BALANCE',
        amount: closingCash,
        notes: `Expected ${expectedCash}, difference ${cashDifference}`
      }
    });

    return {
      attendance: closedAttendance,
      session: closedSession,
      summary: {
        openingCash: session.openingCash,
        cashSales,
        cashIn,
        refunds,
        cashOut,
        expectedCash,
        closingCash,
        cashDifference,
        currentBalance: closingCash
      }
    };
  });

  await writeAudit({
    userId: input.actorId || employee.id,
    storeId: employee.storeId,
    action: cashDifference !== 0 ? 'CASH_MISMATCH' : 'ATTENDANCE_CLOCK_OUT',
    entity: 'CashSession',
    entityId: session.id,
    newData: updated.summary
  });
  await notifyAdmins({
    storeId: employee.storeId,
    title: 'Employee clock out',
    message: `${employee.name} clocked out`,
    type: 'CLOCK_OUT'
  });

  // Refresh weekly salary draft from clock hours when a record already exists
  if (employee.storeId) {
    try {
      const { syncWeeklySalaryAfterAttendance } = await import('@/services/salary.service');
      await syncWeeklySalaryAfterAttendance({
        userId: employee.id,
        storeId: employee.storeId,
        actorId: input.actorId || employee.id
      });
    } catch {
      /* non-blocking */
    }
  }

  return updated;
}
