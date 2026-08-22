export const DEFAULT_GRACE_MINUTES = 10;
export const DEFAULT_SHIFT_START = 14 * 60; // 14:00
export const DEFAULT_SHIFT_END = 22 * 60 + 15; // 22:15

export function minutesFromMidnight(date) {
  const d = new Date(date);
  return d.getHours() * 60 + d.getMinutes();
}

export function formatMinutesClock(total) {
  const h = Math.floor(Number(total || 0) / 60);
  const m = Number(total || 0) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Late by 0–10 minutes = On Time / Grace (no deduction). 11+ = Late; deductible = full late minutes. */
export function evaluateClockIn(clockIn, scheduledStartMinutes = DEFAULT_SHIFT_START, graceMinutes = DEFAULT_GRACE_MINUTES) {
  if (!clockIn) {
    return { status: 'Absent', lateMinutes: 0, deductibleLate: 0, label: 'Absent' };
  }
  const late = Math.max(0, minutesFromMidnight(clockIn) - Number(scheduledStartMinutes || DEFAULT_SHIFT_START));
  if (late === 0) return { status: 'On Time', lateMinutes: 0, deductibleLate: 0, label: 'On Time' };
  if (late <= graceMinutes) {
    return { status: 'Grace', lateMinutes: late, deductibleLate: 0, label: 'On Time / Grace' };
  }
  return { status: 'Late', lateMinutes: late, deductibleLate: late, label: 'Late' };
}

export function evaluateClockOut(clockOut, scheduledEndMinutes = DEFAULT_SHIFT_END) {
  if (!clockOut) return { status: 'Incomplete', earlyMinutes: 0 };
  const early = Math.max(0, Number(scheduledEndMinutes || DEFAULT_SHIFT_END) - minutesFromMidnight(clockOut));
  if (early > 0) return { status: 'Early Clock Out', earlyMinutes: early };
  return { status: 'On Time', earlyMinutes: 0 };
}

export function sessionStatus(row, shiftStart = DEFAULT_SHIFT_START, grace = DEFAULT_GRACE_MINUTES, shiftEnd = DEFAULT_SHIFT_END) {
  const inn = evaluateClockIn(row?.clockIn, shiftStart, grace);
  const out = evaluateClockOut(row?.clockOut, shiftEnd);
  if (!row?.clockIn) return { ...inn, earlyMinutes: 0 };
  if (!row?.clockOut) return { ...inn, earlyMinutes: 0, label: inn.label === 'Late' ? 'Late · open' : 'On shift' };
  if (out.status === 'Early Clock Out') {
    return { ...inn, earlyMinutes: out.earlyMinutes, label: inn.status === 'Late' ? 'Late · Early out' : 'Early Clock Out' };
  }
  return { ...inn, earlyMinutes: 0 };
}
