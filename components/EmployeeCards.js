'use client';

import { useMemo, useState } from 'react';
import { sessionStatus } from '../lib/attendance-rules';

const money = (n) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(Number(n || 0));

function timeLabel(value) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function hoursOf(row) {
  if (row?.hours != null) return Number(row.hours);
  if (row?.workMinutes) return Number(row.workMinutes) / 60;
  if (row?.clockIn && row?.clockOut) {
    return Math.max(0, (new Date(row.clockOut) - new Date(row.clockIn)) / 3600000);
  }
  return 0;
}

function inRange(row, from, to) {
  if (!from && !to) return true;
  const d = new Date(row.date || row.clockIn);
  if (Number.isNaN(d.getTime())) return false;
  if (from && d < new Date(`${from}T00:00:00`)) return false;
  if (to && d > new Date(`${to}T23:59:59`)) return false;
  return true;
}

export default function EmployeeCards({
  staff = [],
  attendance = [],
  salaries = [],
  currentUser,
  isAdmin,
  canSeeAllStaff,
  showPayroll,
  reportFrom,
  reportTo,
  onEditSalary,
  onRecalculateSalary,
  onPaySalary,
  onDownloadAttendance,
  onDownloadPayroll
}) {
  const seeAll = canSeeAllStaff ?? isAdmin;
  const payroll = showPayroll ?? isAdmin;
  const [search, setSearch] = useState('');
  const [employeeId, setEmployeeId] = useState(seeAll ? 'all' : currentUser?.id || 'all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [recalc, setRecalc] = useState(null);

  const people = useMemo(() => {
    const list = seeAll
      ? staff.filter((s) => s.role !== 'ADMIN' || s.id === currentUser?.id)
      : staff.filter((s) => s.id === currentUser?.id).length
        ? staff.filter((s) => s.id === currentUser?.id)
        : currentUser
          ? [currentUser]
          : [];
    const q = search.trim().toLowerCase();
    return list.filter((p) => {
      if (employeeId !== 'all' && p.id !== employeeId) return false;
      if (!q) return true;
      return [p.name, p.employeeId, p.email, p.phone, p.preset, p.role].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [staff, seeAll, currentUser, search, employeeId]);

  const cards = people.map((person) => {
    const sessions = attendance
      .filter((a) => (a.userId || a.user?.id) === person.id && inRange(a, reportFrom, reportTo))
      .sort((a, b) => new Date(b.date || b.clockIn) - new Date(a.date || a.clockIn));
    const today = sessions.find((a) => new Date(a.date || a.clockIn).toDateString() === new Date().toDateString());
    const stats = sessions.reduce(
      (acc, row) => {
        const st = sessionStatus(row);
        acc.hours += hoursOf(row);
        if (row.clockIn) acc.days += 1;
        if (st.status === 'On Time' || st.status === 'Grace') acc.onTime += 1;
        if (st.status === 'Late') acc.late += 1;
        if (st.status === 'Absent') acc.absent += 1;
        if (st.earlyMinutes > 0) acc.early += 1;
        acc.lateMinutes += st.lateMinutes || 0;
        return acc;
      },
      { days: 0, hours: 0, onTime: 0, late: 0, absent: 0, early: 0, lateMinutes: 0 }
    );
    const payroll = salaries.filter((s) => s.userId === person.id || s.user?.id === person.id);
    const latestPay = payroll[0];
    const todayStatus = sessionStatus(today || {});
    return { person, sessions, today, stats, payroll, latestPay, todayStatus };
  }).filter((card) => {
    if (statusFilter === 'late') return card.stats.late > 0;
    if (statusFilter === 'ontime') return card.stats.onTime > 0;
    if (statusFilter === 'absent') return card.stats.absent > 0;
    if (statusFilter === 'early') return card.stats.early > 0;
    if (statusFilter === 'paid') return card.latestPay?.paymentStatus === 'PAID';
    if (statusFilter === 'pending') return card.latestPay && card.latestPay.paymentStatus !== 'PAID';
    return true;
  });

  const overview = cards.reduce(
    (acc, c) => {
      acc.employees += 1;
      if (c.today?.clockIn && !c.today?.clockOut) acc.in += 1;
      if (c.today?.clockOut) acc.out += 1;
      acc.onTime += c.stats.onTime;
      acc.late += c.stats.late;
      acc.absent += c.stats.absent;
      acc.hours += c.stats.hours;
      acc.lateMinutes += c.stats.lateMinutes;
      return acc;
    },
    { employees: 0, in: 0, out: 0, onTime: 0, late: 0, absent: 0, hours: 0, lateMinutes: 0 }
  );

  return (
    <>
      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat-card"><span>Employees</span><strong>{overview.employees}</strong></div>
        <div className="stat-card"><span>Clocked in</span><strong>{overview.in}</strong></div>
        <div className="stat-card"><span>Clocked out</span><strong>{overview.out}</strong></div>
        <div className="stat-card"><span>On time</span><strong>{overview.onTime}</strong></div>
        <div className="stat-card"><span>Late</span><strong>{overview.late}</strong></div>
        <div className="stat-card"><span>Absent</span><strong>{overview.absent}</strong></div>
        <div className="stat-card"><span>Hours</span><strong>{overview.hours.toFixed(1)}h</strong></div>
        <div className="stat-card"><span>Late minutes</span><strong>{overview.lateMinutes}</strong></div>
      </div>
      <div className="filters" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        {seeAll && (
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="all">All employees</option>
            {staff.filter((s) => s.role !== 'ADMIN').map((s) => (
              <option key={s.id} value={s.id}>{s.name} · {s.employeeId}</option>
            ))}
          </select>
        )}
        {[
          ['all', 'All'],
          ['ontime', 'On time'],
          ['late', 'Late'],
          ['absent', 'Absent'],
          ['early', 'Early out'],
          ...(payroll ? [['paid', 'Paid'], ['pending', 'Pending payroll']] : [])
        ].map(([id, label]) => (
          <button key={id} type="button" className={`chip ${statusFilter === id ? 'active' : ''}`} onClick={() => setStatusFilter(id)}>{label}</button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or ID"
          style={{ minWidth: 200, border: '1px solid var(--line)', borderRadius: 999, padding: '8px 14px' }}
        />
        <button type="button" className="btn" onClick={() => onDownloadAttendance?.()}>Download all attendance</button>
        {payroll && onDownloadPayroll && (
          <button type="button" className="btn" onClick={() => onDownloadPayroll()}>Download all payroll</button>
        )}
      </div>
      <div className="staff-card-grid">
        {cards.length ? cards.map((card) => {
          const open = openId === card.person.id;
          return (
            <article className="staff-card" key={card.person.id}>
              <header className="staff-card-head">
                <div>
                  <b>{card.person.name}</b>
                  <small>{card.person.employeeId || 'No ID'} · {card.person.role || 'Staff'} · {card.person.isActive === false ? 'Inactive' : 'Active'}</small>
                </div>
                <span className={`badge ${card.todayStatus.status === 'Late' ? 'warning' : 'paid'}`}>{card.todayStatus.label || '—'}</span>
              </header>
              <p className="subhead">Shift 14:00 → 22:15 · 10 min grace</p>
              <div className="staff-card-today">
                <div><span>Clock in</span><strong>{timeLabel(card.today?.clockIn)}</strong></div>
                <div><span>Clock out</span><strong>{timeLabel(card.today?.clockOut)}</strong></div>
                <div><span>Late</span><strong>{card.todayStatus.lateMinutes || 0} min</strong></div>
              </div>
              <div className="staff-card-period">
                <div><span>Days</span><strong>{card.stats.days}</strong></div>
                <div><span>Hours</span><strong>{card.stats.hours.toFixed(1)}h</strong></div>
                <div><span>On time</span><strong>{card.stats.onTime}</strong></div>
                <div><span>Late days</span><strong>{card.stats.late}</strong></div>
              </div>
              {payroll && card.latestPay && (
                <div className="staff-card-pay">
                  <span>Calculated {money(card.latestPay.calculatedSalary)}</span>
                  <span>Paid {money(card.latestPay.paidAmount)}</span>
                  <span>Due {money(card.latestPay.dueAmount)}</span>
                  <span className={`badge ${card.latestPay.paymentStatus === 'PAID' ? 'paid' : 'warning'}`}>{card.latestPay.paymentStatus}</span>
                </div>
              )}
              <div className="row-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                <button type="button" className="btn" onClick={() => setOpenId(open ? null : card.person.id)}>
                  {open ? 'Hide attendance' : 'View attendance details'}
                </button>
                <button type="button" className="btn" onClick={() => onDownloadAttendance?.(card.person)}>Attendance PDF</button>
                {payroll && (
                  <>
                    <button type="button" className="btn" onClick={() => onDownloadPayroll?.(card.person)}>Payroll PDF</button>
                    {card.latestPay && (
                      <>
                        <button type="button" className="btn" onClick={() => onEditSalary?.(card.latestPay)}>Edit</button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => {
                            const expected = Number(card.latestPay.expectedHours || 40) || 40;
                            const hourly = Number(card.latestPay.baseSalary || 0) / expected;
                            const next = Math.max(0, Number((card.stats.hours * hourly).toFixed(2)));
                            setRecalc({
                              id: card.latestPay.id,
                              name: card.person.name,
                              previous: Number(card.latestPay.calculatedSalary || 0),
                              next
                            });
                          }}
                        >
                          Recalc
                        </button>
                        {card.latestPay.paymentStatus !== 'PAID' && (
                          <>
                            <button type="button" className="btn primary" onClick={() => onPaySalary?.(card.latestPay.id, 'full')}>Pay full</button>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => {
                                const amt = window.prompt('Partial payment (£)', String(Math.min(50, card.latestPay.dueAmount || 0)));
                                if (amt != null && Number(amt) > 0) onPaySalary?.(card.latestPay.id, 'partial', Number(amt));
                              }}
                            >
                              Pay partial
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
              {open && (
                <div className="sheet-wrap" style={{ marginTop: 12 }}>
                  <table className="sheet" style={{ minWidth: 560 }}>
                    <thead>
                      <tr>
                        <th>Date</th><th>Clock in</th><th>Clock out</th><th>Hours</th><th>Status</th><th>Late</th>
                      </tr>
                    </thead>
                    <tbody>
                      {card.sessions.length ? card.sessions.map((row) => {
                        const st = sessionStatus(row);
                        return (
                          <tr key={row.id}>
                            <td>{new Date(row.date || row.clockIn).toLocaleDateString('en-GB')}</td>
                            <td>{timeLabel(row.clockIn)}</td>
                            <td>{timeLabel(row.clockOut)}</td>
                            <td>{hoursOf(row).toFixed(1)}h</td>
                            <td>{st.label}</td>
                            <td>{st.lateMinutes} min</td>
                          </tr>
                        );
                      }) : (
                        <tr><td colSpan={6}>No attendance in this period.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          );
        }) : <p className="empty-table">No employees match these filters.</p>}
      </div>
      {recalc && (
        <div className="staff-recalc-overlay" onClick={() => setRecalc(null)}>
          <div className="staff-recalc-card" onClick={(e) => e.stopPropagation()}>
            <h3>Recalculate payroll</h3>
            <p>{recalc.name}</p>
            <p>Previous calculation: {money(recalc.previous)}</p>
            <p>New calculation: {money(recalc.next)}</p>
            <div className="header-actions">
              <button type="button" className="btn" onClick={() => setRecalc(null)}>Cancel</button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  onRecalculateSalary?.(recalc.id);
                  setRecalc(null);
                }}
              >
                Confirm save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
