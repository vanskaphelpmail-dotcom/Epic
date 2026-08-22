import { PaymentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { roundMoney } from '@/lib/money';
import { writeAudit } from '@/services/audit.service';
import { endOfDay, startOfDay } from '@/lib/date-range';

export type SalaryPeriodType = 'week' | 'month';

function paymentStatus(paid: number, due: number): PaymentStatus {
  if (due <= 0.001) return 'PAID';
  if (paid > 0) return 'PARTIAL';
  return 'UNPAID';
}

/** Monday 00:00 → Sunday 23:59:59 for the week containing `ref`. */
export function getWeekBounds(ref = new Date()) {
  const d = startOfDay(ref);
  const day = d.getDay(); // 0 Sun … 6 Sat
  const offsetToMon = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + offsetToMon);
  const endDate = new Date(start);
  endDate.setDate(start.getDate() + 6);
  return { start, end: endOfDay(endDate) };
}

export function getMonthBounds(ref = new Date()) {
  const start = startOfDay(new Date(ref.getFullYear(), ref.getMonth(), 1));
  const end = endOfDay(new Date(ref.getFullYear(), ref.getMonth() + 1, 0));
  return { start, end };
}

export function resolveSalaryPeriod(
  periodType: SalaryPeriodType,
  anchor?: string | Date | null
) {
  const ref = anchor ? new Date(anchor) : new Date();
  if (Number.isNaN(ref.getTime())) throw new AppError('VALIDATION_ERROR', 'Invalid period date');
  return periodType === 'month' ? getMonthBounds(ref) : getWeekBounds(ref);
}

export async function summarizeAttendance(input: {
  userId: string;
  storeId?: string | null;
  periodStart: Date;
  periodEnd: Date;
}) {
  const rows = await prisma.attendance.findMany({
    where: {
      userId: input.userId,
      ...(input.storeId ? { storeId: input.storeId } : {}),
      date: { gte: input.periodStart, lte: input.periodEnd }
    },
    orderBy: { date: 'asc' }
  });

  const now = Date.now();
  let totalMinutes = 0;
  let workingDays = 0;

  for (const row of rows) {
    if (!row.clockIn) continue;
    workingDays += 1;
    if (row.workMinutes > 0) {
      totalMinutes += row.workMinutes;
    } else if (!row.clockOut) {
      // Still on shift — count elapsed time
      totalMinutes += Math.max(0, Math.round((now - row.clockIn.getTime()) / 60000));
    } else {
      totalMinutes += Math.max(
        0,
        Math.round((row.clockOut.getTime() - row.clockIn.getTime()) / 60000)
      );
    }
  }

  const workingHours = roundMoney(totalMinutes / 60);
  const deductibleLateMinutes = rows.reduce((sum, row) => {
    const late = Number(row.lateMinutes || 0);
    return sum + (late > 10 ? late : 0);
  }, 0);
  const lateDeductionStored = roundMoney(rows.reduce((sum, row) => sum + Number(row.salaryDeduction || 0), 0));
  return { workingDays, workingHours, totalMinutes, attendances: rows, deductibleLateMinutes, lateDeductionStored };
}

/**
 * baseSalary = agreed pay for a full period (week or month).
 * calculated = pro-rated by hours worked vs expected hours.
 */
export function computeSalaryAmount(input: {
  baseSalary: number;
  workingHours: number;
  periodType: SalaryPeriodType;
  expectedHours?: number;
  deductibleLateMinutes?: number;
}) {
  const base = Math.max(0, Number(input.baseSalary) || 0);
  const hours = Math.max(0, Number(input.workingHours) || 0);
  const expected =
    input.expectedHours != null && input.expectedHours > 0
      ? input.expectedHours
      : input.periodType === 'week'
        ? 40
        : 160;
  const hourly = expected > 0 ? base / expected : 0;
  const lateDeduction = roundMoney((Math.max(0, Number(input.deductibleLateMinutes || 0)) / 60) * hourly);
  const calculatedSalary = roundMoney(Math.max(0, Math.min(hours * hourly, base * 1.5) - lateDeduction));
  return { expectedHours: expected, hourlyRate: roundMoney(hourly), calculatedSalary, lateDeduction };
}

export async function previewSalary(input: {
  userId: string;
  storeId?: string | null;
  baseSalary: number;
  periodType: SalaryPeriodType;
  periodAnchor?: string | Date | null;
  expectedHours?: number;
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new AppError('NOT_FOUND', 'Employee not found', 404);

  const { start, end } = resolveSalaryPeriod(input.periodType, input.periodAnchor);
  const attendance = await summarizeAttendance({
    userId: input.userId,
    storeId: input.storeId || user.storeId,
    periodStart: start,
    periodEnd: end
  });
    const calc = computeSalaryAmount({
      baseSalary: input.baseSalary,
      workingHours: attendance.workingHours,
      periodType: input.periodType,
      expectedHours: input.expectedHours,
      deductibleLateMinutes: attendance.deductibleLateMinutes
    });

  return {
    user: { id: user.id, name: user.name, employeeId: user.employeeId },
    periodType: input.periodType,
    periodStart: start,
    periodEnd: end,
    workingDays: attendance.workingDays,
    workingHours: attendance.workingHours,
    baseSalary: roundMoney(input.baseSalary),
    ...calc,
    dueAmount: calc.calculatedSalary
  };
}

export async function createSalaryRecord(input: {
  userId: string;
  storeId: string;
  actorId: string;
  baseSalary: number;
  paidAmount?: number;
  periodType?: SalaryPeriodType;
  periodAnchor?: string | Date | null;
  periodStart?: string | Date | null;
  periodEnd?: string | Date | null;
  workingDays?: number;
  workingHours?: number;
  calculatedSalary?: number;
  expectedHours?: number;
  autoCalculate?: boolean;
  notes?: string;
}) {
  const periodType = input.periodType || 'week';
  let periodStart: Date;
  let periodEnd: Date;

  if (input.periodStart && input.periodEnd) {
    periodStart = startOfDay(new Date(input.periodStart));
    periodEnd = endOfDay(new Date(input.periodEnd));
  } else {
    const bounds = resolveSalaryPeriod(periodType, input.periodAnchor);
    periodStart = bounds.start;
    periodEnd = bounds.end;
  }

  let workingDays = Number(input.workingDays || 0);
  let workingHours = Number(input.workingHours || 0);
  let calculatedSalary =
    input.calculatedSalary != null ? Number(input.calculatedSalary) : Number(input.baseSalary);

  if (input.autoCalculate !== false) {
    const attendance = await summarizeAttendance({
      userId: input.userId,
      storeId: input.storeId,
      periodStart,
      periodEnd
    });
    workingDays = attendance.workingDays;
    workingHours = attendance.workingHours;
    const calc = computeSalaryAmount({
      baseSalary: input.baseSalary,
      workingHours,
      periodType,
      expectedHours: input.expectedHours,
      deductibleLateMinutes: attendance.deductibleLateMinutes
    });
    if (input.calculatedSalary == null) {
      calculatedSalary = calc.calculatedSalary;
    }
  }

  const paid = Math.max(0, Number(input.paidAmount || 0));
  const due = roundMoney(Math.max(0, calculatedSalary - paid));

  const existing = await prisma.salaryRecord.findFirst({
    where: {
      userId: input.userId,
      storeId: input.storeId,
      periodStart,
      periodEnd
    }
  });
  if (existing) {
    throw new AppError(
      'DUPLICATE_RECORD',
      'Salary record already exists for this employee and period — edit it instead'
    );
  }

  const row = await prisma.salaryRecord.create({
    data: {
      userId: input.userId,
      storeId: input.storeId,
      periodStart,
      periodEnd,
      workingDays,
      workingHours,
      baseSalary: roundMoney(input.baseSalary),
      calculatedSalary: roundMoney(calculatedSalary),
      paidAmount: paid,
      dueAmount: due,
      paymentStatus: paymentStatus(paid, due),
      notes:
        input.notes ||
        `${periodType === 'week' ? 'Weekly' : 'Monthly'} payroll · auto from attendance`
    },
    include: { user: true }
  });

  await writeAudit({
    userId: input.actorId,
    storeId: input.storeId,
    action: 'SALARY_CREATE',
    entity: 'SalaryRecord',
    entityId: row.id,
    newData: {
      workingHours,
      calculatedSalary,
      periodType
    }
  });

  return row;
}

export async function updateSalaryRecord(input: {
  id: string;
  actorId: string;
  storeId?: string | null;
  baseSalary?: number;
  calculatedSalary?: number;
  paidAmount?: number;
  workingDays?: number;
  workingHours?: number;
  notes?: string;
  recalculate?: boolean;
  periodType?: SalaryPeriodType;
  expectedHours?: number;
}) {
  const existing = await prisma.salaryRecord.findUnique({
    where: { id: input.id },
    include: { user: true }
  });
  if (!existing) throw new AppError('NOT_FOUND', 'Salary record not found', 404);

  let workingDays = input.workingDays ?? existing.workingDays;
  let workingHours = input.workingHours ?? existing.workingHours;
  let baseSalary = input.baseSalary ?? existing.baseSalary;
  let calculatedSalary = input.calculatedSalary ?? existing.calculatedSalary;

  if (input.recalculate) {
    const attendance = await summarizeAttendance({
      userId: existing.userId,
      storeId: existing.storeId,
      periodStart: existing.periodStart,
      periodEnd: existing.periodEnd
    });
    workingDays = attendance.workingDays;
    workingHours = attendance.workingHours;
    const spanMs = existing.periodEnd.getTime() - existing.periodStart.getTime();
    const periodType: SalaryPeriodType =
      input.periodType || (spanMs <= 8 * 24 * 60 * 60 * 1000 ? 'week' : 'month');
    const calc = computeSalaryAmount({
      baseSalary,
      workingHours,
      periodType,
      expectedHours: input.expectedHours,
      deductibleLateMinutes: attendance.deductibleLateMinutes
    });
    calculatedSalary = calc.calculatedSalary;
  }

  const paid =
    input.paidAmount != null ? Math.max(0, Number(input.paidAmount)) : existing.paidAmount;
  const due = roundMoney(Math.max(0, calculatedSalary - paid));

  const row = await prisma.salaryRecord.update({
    where: { id: input.id },
    data: {
      baseSalary: roundMoney(baseSalary),
      calculatedSalary: roundMoney(calculatedSalary),
      workingDays,
      workingHours,
      paidAmount: paid,
      dueAmount: due,
      paymentStatus: paymentStatus(paid, due),
      ...(input.notes != null ? { notes: input.notes } : {})
    },
    include: { user: true }
  });

  await writeAudit({
    userId: input.actorId,
    storeId: input.storeId || existing.storeId,
    action: 'SALARY_UPDATE',
    entity: 'SalaryRecord',
    entityId: row.id,
    newData: { paid, due, calculatedSalary, recalculate: Boolean(input.recalculate) }
  });

  return row;
}

export async function paySalary(input: {
  id: string;
  actorId: string;
  storeId?: string | null;
  mode: 'full' | 'partial';
  amount?: number;
}) {
  const existing = await prisma.salaryRecord.findUnique({ where: { id: input.id } });
  if (!existing) throw new AppError('NOT_FOUND', 'Salary record not found', 404);

  let paid = existing.paidAmount;
  if (input.mode === 'full') {
    paid = existing.calculatedSalary;
  } else {
    const extra = Number(input.amount || 0);
    if (extra <= 0) throw new AppError('VALIDATION_ERROR', 'Enter a payment amount greater than 0');
    paid = roundMoney(existing.paidAmount + extra);
  }
  if (paid > existing.calculatedSalary) paid = existing.calculatedSalary;

  return updateSalaryRecord({
    id: input.id,
    actorId: input.actorId,
    storeId: input.storeId,
    paidAmount: paid
  });
}

/** After clock-out, refresh this week's salary draft if one already exists. */
export async function syncWeeklySalaryAfterAttendance(input: {
  userId: string;
  storeId: string;
  actorId: string;
}) {
  const { start, end } = getWeekBounds(new Date());
  const existing = await prisma.salaryRecord.findFirst({
    where: {
      userId: input.userId,
      storeId: input.storeId,
      periodStart: start,
      periodEnd: end
    }
  });
  if (!existing) return null;

  return updateSalaryRecord({
    id: existing.id,
    actorId: input.actorId,
    storeId: input.storeId,
    recalculate: true,
    periodType: 'week'
  });
}

function fmtTime(d: Date | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtDay(d: Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function weekKey(d: Date) {
  const { start, end } = getWeekBounds(d);
  return {
    key: start.toISOString().slice(0, 10),
    start,
    end,
    label: `${fmtDay(start)} – ${fmtDay(end)}`
  };
}

/** Salary rows with per-day clock in/out and weekly hour totals for Payroll UI. */
export async function listSalariesWithClock(storeId?: string | null) {
  const rows = await prisma.salaryRecord.findMany({
    where: storeId ? { storeId } : {},
    include: { user: true },
    orderBy: { periodStart: 'desc' },
    take: 100
  });

  if (!rows.length) return [];

  const minStart = rows.reduce(
    (min, r) => (r.periodStart < min ? r.periodStart : min),
    rows[0].periodStart
  );
  const maxEnd = rows.reduce(
    (max, r) => (r.periodEnd > max ? r.periodEnd : max),
    rows[0].periodEnd
  );
  const userIds = [...new Set(rows.map((r) => r.userId))];

  const attendance = await prisma.attendance.findMany({
    where: {
      userId: { in: userIds },
      ...(storeId ? { storeId } : {}),
      date: { gte: minStart, lte: maxEnd },
      clockIn: { not: null }
    },
    orderBy: { date: 'asc' }
  });

  return rows.map((row) => {
    const sessions = attendance
      .filter(
        (a) =>
          a.userId === row.userId &&
          a.date >= row.periodStart &&
          a.date <= row.periodEnd
      )
      .map((a) => {
        let minutes = a.workMinutes || 0;
        if (!minutes && a.clockIn && a.clockOut) {
          minutes = Math.max(
            0,
            Math.round((a.clockOut.getTime() - a.clockIn.getTime()) / 60000)
          );
        }
        return {
          id: a.id,
          date: a.date,
          dayLabel: fmtDay(a.date),
          clockIn: a.clockIn,
          clockOut: a.clockOut,
          clockInLabel: fmtTime(a.clockIn) || '—',
          clockOutLabel: a.clockOut ? fmtTime(a.clockOut) || '—' : 'Open',
          minutes,
          hours: roundMoney(minutes / 60)
        };
      });

    const weekMap = new Map<
      string,
      {
        key: string;
        label: string;
        start: Date;
        end: Date;
        hours: number;
        days: number;
        sessions: typeof sessions;
      }
    >();

    for (const s of sessions) {
      const w = weekKey(new Date(s.date));
      const bucket = weekMap.get(w.key) || {
        key: w.key,
        label: w.label,
        start: w.start,
        end: w.end,
        hours: 0,
        days: 0,
        sessions: [] as typeof sessions
      };
      bucket.hours = roundMoney(bucket.hours + s.hours);
      bucket.days += 1;
      bucket.sessions.push(s);
      weekMap.set(w.key, bucket);
    }

    const weekly = [...weekMap.values()].sort(
      (a, b) => a.start.getTime() - b.start.getTime()
    );
    const needsPay = row.paymentStatus !== 'PAID' && Number(row.dueAmount || 0) > 0.001;

    return {
      ...row,
      needsPay,
      clockSessions: sessions,
      weeklyTotals: weekly,
      weeklyHoursTotal: roundMoney(weekly.reduce((sum, w) => sum + w.hours, 0))
    };
  });
}
