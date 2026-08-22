'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import DateField from './DateField';
import { REQUEST_STATUSES, REQUEST_TYPES, requestTypeLabel, statusLabel } from '../lib/request-types';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const emptyForm = () => ({
  type: 'PAYSLIP',
  reason: '',
  message: '',
  requiredDate: '',
  periodMonth: String(new Date().getMonth() + 1),
  periodYear: String(new Date().getFullYear()),
  holidayStart: '',
  holidayEnd: '',
  joiningDate: '',
  position: '',
  purpose: '',
  destination: '',
  extraTitle: ''
});

export default function RequestModules({ user, isAdmin, toast }) {
  const canManage = Boolean(
    isAdmin ||
      (user?.permissions || []).some((permission) => ['DOCUMENT_VIEW', 'SALARY_VIEW'].includes(permission))
  );
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);
  const [comment, setComment] = useState('');
  const [file, setFile] = useState(null);

  const load = async () => {
    const res = await api('/requests');
    setRows(res.data || []);
  };
  useEffect(() => { load().catch((e) => toast?.(e.message)); }, []);

  const openRequest = async (row) => {
    setOpen(row);
    if (!row?.id) return;
    try {
      const res = await api(`/requests/${encodeURIComponent(row.id)}`);
      if (res.data) setOpen(res.data);
    } catch (err) {
      toast?.(err.message);
    }
  };

  useEffect(() => {
    const openFromCode = (code) => {
      if (!code || !rows.length) return false;
      const match = rows.find((r) => r.requestCode === code || r.id === code);
      if (match) {
        setOpen(match);
        return true;
      }
      return false;
    };
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem('openRequestCode') : null;
    if (stored && openFromCode(stored)) sessionStorage.removeItem('openRequestCode');
    const onOpen = (e) => {
      const code = e.detail;
      if (!openFromCode(code)) sessionStorage.setItem('openRequestCode', code || '');
    };
    window.addEventListener('open-request', onOpen);
    return () => window.removeEventListener('open-request', onOpen);
  }, [rows]);

  const listed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== 'all' && r.status !== filter && !(filter === 'OVERDUE' && r.overdue)) return false;
      if (!q) return true;
      return [r.requestCode, r.type, r.employee?.name, r.employee?.employeeId, r.message, r.reason]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, filter, search]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const start = form.holidayStart ? new Date(form.holidayStart) : null;
      const end = form.holidayEnd ? new Date(form.holidayEnd) : null;
      const days = start && end ? Math.max(1, Math.round((end - start) / 86400000) + 1) : undefined;
      const details = {
        holidayStart: form.holidayStart,
        holidayEnd: form.holidayEnd,
        holidayDays: days,
        joiningDate: form.joiningDate,
        position: form.position,
        purpose: form.purpose,
        destination: form.destination,
        extraTitle: form.extraTitle,
        letterContent: form.reason
      };
      const usesSalaryPeriod = form.type === 'PAYSLIP' || form.type === 'SALARY_CERTIFICATE';
      await api('/requests', {
        method: 'POST',
        body: JSON.stringify({
          type: form.type,
          reason: form.reason || form.purpose || form.extraTitle,
          message: form.message,
          requiredDate: form.requiredDate || undefined,
          periodMonth: usesSalaryPeriod ? Number(form.periodMonth) : undefined,
          periodYear: usesSalaryPeriod ? Number(form.periodYear) : undefined,
          details
        })
      });
      toast?.('Request submitted');
      setForm(emptyForm());
      setShowForm(false);
      await load();
    } catch (err) {
      toast?.(err.message);
    }
  };

  const act = async (id, status, extraComment) => {
    try {
      await api(`/requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status, comment: extraComment || comment || undefined }) });
      setComment('');
      await load();
      if (open?.id === id) setOpen((await api(`/requests/${id}`)).data);
      toast?.('Request updated');
    } catch (err) {
      toast?.(err.message);
    }
  };

  const sendComment = async (id) => {
    try {
      await api(`/requests/${id}`, { method: 'PATCH', body: JSON.stringify({ comment }) });
      setComment('');
      await load();
      setOpen((await api(`/requests/${id}`)).data);
    } catch (err) {
      toast?.(err.message);
    }
  };

  const uploadPdf = async (id) => {
    if (!file) return toast?.('Choose a PDF');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`/api/requests/${id}/upload`, { method: 'POST', credentials: 'include', body });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error?.message || 'Upload failed');
      toast?.('PDF saved to Employee documents directory');
      setFile(null);
      await load();
      setOpen((await api(`/requests/${id}`)).data);
    } catch (err) {
      toast?.(err.message);
    }
  };

  return (
    <section className="module panel">
      <div className="module-head">
        <div>
          <h2>{canManage ? 'Employee requests' : 'My requests'}</h2>
          <p>Official letters, payslips and certificates</p>
        </div>
        {!isAdmin ? (
          <button className="btn primary" type="button" onClick={() => setShowForm((v) => !v)}>+ New request</button>
        ) : (
          <button className="btn" type="button" onClick={() => setShowForm((v) => !v)}>Create request</button>
        )}
      </div>

      {showForm && (
        <form className="add-form" onSubmit={submit}>
          <div className="form-grid">
            <label>Document type
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {REQUEST_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            {(form.type === 'PAYSLIP' || form.type === 'SALARY_CERTIFICATE') && (
              <>
                <label>Month
                  <select value={form.periodMonth} onChange={(e) => setForm({ ...form, periodMonth: e.target.value })}>
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </label>
                <label>Year<input value={form.periodYear} onChange={(e) => setForm({ ...form, periodYear: e.target.value })} /></label>
              </>
            )}
            {(form.type === 'HOLIDAY_LETTER' || form.type === 'LEAVE_APPROVAL') && (
              <>
                <label>Start date<DateField value={form.holidayStart} onChange={(v) => setForm({ ...form, holidayStart: v })} /></label>
                <label>End date<DateField value={form.holidayEnd} onChange={(v) => setForm({ ...form, holidayEnd: v })} /></label>
              </>
            )}
            {form.type === 'JOINING_LETTER' && (
              <>
                <label>Joining date<DateField value={form.joiningDate} onChange={(v) => setForm({ ...form, joiningDate: v })} /></label>
                <label>Position<input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></label>
              </>
            )}
            {['EXPERIENCE_LETTER', 'NOC', 'EMPLOYEE_LETTER', 'EMPLOYMENT_VERIFICATION', 'SALARY_CERTIFICATE'].includes(form.type) && (
              <label>Purpose<input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></label>
            )}
            {form.type === 'EMPLOYEE_LETTER' && (
              <label>Required content<input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="What the letter should say" /></label>
            )}
            {form.type === 'NOC' && (
              <label>Destination / company<input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></label>
            )}
            {form.type === 'OTHER' && (
              <label>Document title<input required value={form.extraTitle} onChange={(e) => setForm({ ...form, extraTitle: e.target.value })} /></label>
            )}
            <label>Required date<DateField allowClear value={form.requiredDate} onChange={(v) => setForm({ ...form, requiredDate: v })} /></label>
            <label>Reason / message<input value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="I need this document because…" /></label>
          </div>
          <button className="btn primary" type="submit">Submit request</button>
        </form>
      )}

      <div className="filters" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {['all', 'OVERDUE', ...REQUEST_STATUSES].map((id) => (
          <button key={id} type="button" className={`chip ${filter === id ? 'active' : ''}`} onClick={() => setFilter(id)}>
            {id === 'all' ? 'All' : statusLabel(id)}
          </button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID or request" style={{ minWidth: 200, border: '1px solid var(--line)', borderRadius: 999, padding: '8px 14px' }} />
      </div>

      <div className="staff-card-grid">
        {listed.length ? listed.map((r) => (
          <article className="staff-card" key={r.id}>
            <header className="staff-card-head">
              <div>
                <b>{requestTypeLabel(r.type)}</b>
                <small>{r.requestCode} · {r.employee?.name} · {r.employee?.employeeId}</small>
              </div>
              <span className={`badge ${r.status === 'READY' || r.status === 'COMPLETED' ? 'paid' : 'warning'}`}>{statusLabel(r.overdue ? 'OVERDUE' : r.status)}</span>
            </header>
            <p className="subhead">
              Requested {new Date(r.createdAt).toLocaleString('en-GB')}
              {r.requiredDate ? ` · Required ${new Date(r.requiredDate).toLocaleDateString('en-GB')}` : ''}
            </p>
            {r.adminComment ? <p className="subhead">Admin: {r.adminComment}</p> : null}
            {r.details?.holidayDays ? <p className="subhead">{r.details.holidayDays} day(s) · {r.details.holidayStart} → {r.details.holidayEnd}</p> : null}
            <div className="row-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
              <button type="button" className="btn" onClick={() => openRequest(r)}>View request</button>
              {canManage ? (
                <button type="button" className="btn" onClick={() => openRequest(r)}>Review</button>
              ) : null}
              {r.fileUrl && (canManage || r.employeeId === user?.id) ? (
                <a className="btn primary" href={`/api/requests/${r.id}/download`}>Download PDF</a>
              ) : canManage ? (
                <label className="btn">
                  Upload PDF
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    hidden
                    onChange={(e) => {
                      const picked = e.target.files?.[0];
                      if (!picked) return;
                      setFile(picked);
                      setOpen(r);
                    }}
                  />
                </label>
              ) : (
                <span className="subhead">Waiting for PDF</span>
              )}
            </div>
          </article>
        )) : <p className="empty-table">No requests yet.</p>}
      </div>

      {open && (
        <div className="invoice-overlay" onClick={() => setOpen(null)}>
          <div className="invoice-card billing-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <h2>{open.requestCode}</h2>
            <p className="modal-sub">
              {open.employee?.name} · {open.employee?.employeeId} · {open.employee?.role} · {requestTypeLabel(open.type)} · {statusLabel(open.status)}
            </p>
            <p>{open.message || open.reason || 'No message'}</p>
            {open.fileUrl ? (
              <p className="subhead">
                Document ready: {open.fileName} · {open.fileSize ? `${Math.round(open.fileSize / 1024)} KB` : ''} · uploaded {new Date(open.updatedAt).toLocaleString('en-GB')}
              </p>
            ) : null}
            <h3 style={{ fontSize: 14 }}>Timeline</h3>
            <ul className="payroll-clock-list">
              {(open.events || []).map((ev) => (
                <li key={ev.id}>
                  <span>{new Date(ev.createdAt).toLocaleString('en-GB')}</span>
                  <span>{ev.user?.name} · {ev.action}</span>
                  <span>{ev.comment || ''}</span>
                </li>
              ))}
            </ul>
            <h3 style={{ fontSize: 14 }}>Comments</h3>
            {(open.comments || []).map((c) => (
              <p key={c.id} className="subhead"><b>{c.user?.name}:</b> {c.body}</p>
            ))}
            <label>Comment
              <input value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>
            <div className="invoice-actions" style={{ flexWrap: 'wrap' }}>
              <button className="btn" type="button" onClick={() => sendComment(open.id)}>Send comment</button>
              {canManage && (
                <>
                  <button className="btn" type="button" onClick={() => act(open.id, 'UNDER_REVIEW')}>Review</button>
                  <button className="btn" type="button" onClick={() => act(open.id, 'NEED_INFORMATION', comment || 'Please provide more information')}>Need information</button>
                  <button className="btn" type="button" onClick={() => act(open.id, 'APPROVED')}>Approve</button>
                  <button className="btn" type="button" onClick={() => act(open.id, 'REJECTED', comment)}>Reject</button>
                  <button className="btn" type="button" onClick={() => act(open.id, 'COMPLETED')}>Mark completed</button>
                  <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  <button className="btn primary" type="button" onClick={() => uploadPdf(open.id)}>Upload PDF to Employee directory</button>
                </>
              )}
              {open.employeeId === user?.id && ['SUBMITTED', 'NEED_INFORMATION', 'UNDER_REVIEW'].includes(open.status) && (
                <button className="btn" type="button" onClick={() => act(open.id, 'CANCELLED')}>Cancel request</button>
              )}
              {open.employeeId === user?.id && open.status === 'NEED_INFORMATION' && (
                <button className="btn primary" type="button" onClick={() => act(open.id, 'SUBMITTED', comment || 'Updated information')}>Resubmit</button>
              )}
              <button className="btn" type="button" onClick={() => setOpen(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
