'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import SearchInput from './SearchInput';

export default function GlobalSearch({ open, onClose, onOpenPage }) {
  const [q, setQ] = useState('');
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      if (q.trim().length < 2) {
        setGroups([]);
        return;
      }
      try {
        const res = await api(`/search?q=${encodeURIComponent(q.trim())}`);
        setGroups(res.data?.groups || []);
      } catch {
        setGroups([]);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, open]);

  if (!open) return null;

  return (
    <div className="global-search-overlay" onClick={onClose}>
      <div className="global-search-card" onClick={(e) => e.stopPropagation()}>
        <SearchInput value={q} onChange={setQ} placeholder="Search products, invoices, suppliers…" />
        <div className="global-search-results">
          {groups.length ? groups.map((g) => (
            <div key={g.key}>
              <p className="nav-label">{g.key}</p>
              {g.items.map((item) => (
                <button
                  type="button"
                  key={`${g.key}-${item.id}`}
                  className="global-search-hit"
                  onClick={() => {
                    onOpenPage?.(item.page);
                    onClose?.();
                  }}
                >
                  <b>{item.label}</b>
                  <small>{item.hint}</small>
                </button>
              ))}
            </div>
          )) : (q.trim().length >= 2 ? <p className="empty-table">No matches.</p> : <p className="subhead">Type at least 2 characters.</p>)}
        </div>
      </div>
    </div>
  );
}
