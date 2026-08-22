'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

const money = (n) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(Number(n || 0));

function extraFiltersFor(type) {
  if (['sales', 'sales-history', 'income', 'unpaid-sales', 'customer-payment-history', 'employee-sales'].includes(type)) {
    return [
      { key: 'staff', label: 'Employee' },
      { key: 'status', label: 'Payment status' },
      { key: 'method', label: 'Payment method' },
      { key: 'customer', label: 'Customer' }
    ];
  }
  if (type === 'expenses') {
    return [
      { key: 'category', label: 'Expense type' },
      { key: 'status', label: 'Payment status' }
    ];
  }
  if (['inventory', 'stock', 'low-stock'].includes(type)) {
    return [
      { key: 'category', label: 'Category' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'status', label: 'Stock status' },
      { key: 'active', label: 'Active / inactive' }
    ];
  }
  if (type === 'attendance') {
    return [
      { key: 'employee', label: 'Employee' },
      { key: 'status', label: 'Attendance status' }
    ];
  }
  if (type.includes('supplier')) {
    return [
      { key: 'supplier', label: 'Supplier' },
      { key: 'overdue', label: 'Status' },
      { key: 'method', label: 'Payment method' }
    ];
  }
  if (['money', 'money-ledger', 'cash-management', 'bank-transactions'].includes(type)) {
    return [
      { key: 'account', label: 'Account' },
      { key: 'direction', label: 'In / Out' },
      { key: 'method', label: 'Method' }
    ];
  }
  return [];
}

export default function ReportDetails({
  type,
  PeriodFilters,
  reportPeriod,
  setReportPeriod,
  reportFrom,
  setReportFrom,
  reportTo,
  setReportTo,
  onBack,
  toast
}) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({});
  const [error, setError] = useState('');
  const pageSize = 25;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ type, period: reportPeriod || 'today' });
      if (reportFrom) params.set('from', reportFrom);
      if (reportTo) params.set('to', reportTo);
      const res = await api(`/reports/data?${params.toString()}`);
      setPayload(res.data);
    } catch (err) {
      setError(err.message || 'Unable to load this report. Please try again.');
      toast?.(err.message || 'Unable to load this report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    setPage(1);
  }, [type, reportPeriod, reportFrom, reportTo]);

  const extra = extraFiltersFor(type);
  const columns = payload?.columns || [];
  const allRows = payload?.rows || [];

  const filterOptions = useMemo(() => {
    const map = {};
    extra.forEach((f) => {
      map[f.key] = [...new Set(allRows.map((r) => r[f.key]).filter((v) => v !== undefined && v !== ''))];
    });
    return map;
  }, [allRows, extra]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = allRows.filter((row) => {
      if (q && !Object.values(row).some((v) => String(v || '').toLowerCase().includes(q))) return false;
      for (const f of extra) {
        const val = filters[f.key];
        if (val && String(row[f.key] || '') !== val) return false;
      }
      return true;
    });
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const cmp = typeof av === 'number' || typeof bv === 'number' ? Number(av || 0) - Number(bv || 0) : String(av || '').localeCompare(String(bv || ''));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [allRows, search, filters, extra, sortKey, sortDir]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shown = filtered.slice((page - 1) * pageSize, page * pageSize);

  const formatCell = (col, value) => {
    if (col.kind === 'money') return money(value);
    return value == null || value === '' ? '—' : String(value);
  };

  const download = (format) => {
    const params = new URLSearchParams({ type, format, period: reportPeriod || 'today' });
    if (reportFrom) params.set('from', reportFrom);
    if (reportTo) params.set('to', reportTo);
    if (search) params.set('q', search);
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    window.open(`/api/reports/download?${params.toString()}`, '_blank', 'noopener,noreferrer');
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <section className="module panel">
      <div className="module-head">
        <div>
          <button type="button" className="btn-text" onClick={onBack}>← Back to Reports</button>
          <h2>{payload?.title || 'Report'}</h2>
          <p>{payload?.periodLabel || ''} · {filtered.length} record{filtered.length === 1 ? '' : 's'}</p>
        </div>
        <div className="row-actions">
          <button className="btn" type="button" onClick={() => download('pdf')}>Download PDF</button>
          <button className="btn primary" type="button" onClick={() => download('excel')}>Download Excel</button>
        </div>
      </div>

      {PeriodFilters}

      <div className="stats" style={{ marginBottom: 16 }}>
        {(payload?.summaries || []).map((s) => (
          <div className="stat-card" key={s.label}>
            <span>{s.label}</span>
            <strong>{typeof s.value === 'number' && /sales|paid|due|amount|expense|profit|value|purchase|income|out|in|average|remaining|calculated|stock value/i.test(s.label) ? money(s.value) : s.value}</strong>
          </div>
        ))}
        <div className="stat-card"><span>Filtered records</span><strong>{filtered.length}</strong></div>
      </div>

      <div className="filters" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search this report"
          style={{ minWidth: 220, border: '1px solid var(--line)', borderRadius: 999, padding: '8px 14px' }}
        />
        {extra.map((f) => (
          <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            {f.label}
            <select
              value={filters[f.key] || ''}
              onChange={(e) => { setFilters({ ...filters, [f.key]: e.target.value }); setPage(1); }}
            >
              <option value="">All</option>
              {(filterOptions[f.key] || []).map((opt) => (
                <option key={String(opt)} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {error ? <p className="subhead">{error}</p> : loading ? <p className="subhead">Loading report…</p> : (
        <>
          <div className="sheet-wrap">
            <table className="sheet" style={{ minWidth: Math.max(720, columns.length * 140) }}>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={col.kind === 'money' || col.kind === 'num' ? 'num' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label}{sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.length ? shown.map((row, i) => (
                  <tr key={i}>
                    {columns.map((col) => (
                      <td key={col.key} className={col.kind === 'money' || col.kind === 'num' ? 'num' : ''}>
                        {formatCell(col, row[col.key])}
                      </td>
                    ))}
                  </tr>
                )) : (
                  <tr><td colSpan={Math.max(1, columns.length)} className="empty-table">No records for this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="row-actions" style={{ marginTop: 12 }}>
            <button className="btn" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span className="subhead">Page {page} of {pages}</span>
            <button className="btn" type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </>
      )}
    </section>
  );
}
