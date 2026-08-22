'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

export default function NotificationBell({ Icon, onOpenPage }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const root = useRef(null);

  const load = async () => {
    try {
      const res = await api('/notifications');
      setItems(res.data?.items || []);
      setUnread(res.data?.unread || 0);
    } catch {
      /* keep last */
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const close = (e) => {
      if (!root.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="notify-wrap" ref={root}>
      <button
        className="btn icon-btn"
        title="Notifications"
        type="button"
        onClick={() => { setOpen((v) => !v); if (!open) load(); }}
      >
        {Icon ? <Icon name="bell" /> : 'Bell'}
        {unread > 0 ? <span className="notify-badge">{unread > 99 ? '99+' : unread}</span> : null}
      </button>
      {open && (
        <div className="notify-panel">
          <div className="notify-panel-head">
            <b>Notifications</b>
            <button
              type="button"
              className="btn-text"
              onClick={async () => {
                await api('/notifications', { method: 'PATCH', body: JSON.stringify({ all: true }) });
                load();
              }}
            >
              Mark all read
            </button>
          </div>
          <div className="notify-list">
            {items.length ? items.map((n) => (
              <button
                type="button"
                key={n.id}
                className={`notify-item ${n.isRead ? '' : 'unread'}`}
                onClick={() => {
                  setOpen(false);
                  const text = `${n.title || ''} ${n.message || ''}`;
                  const code = text.match(/REQ-[A-Z0-9-]+/i)?.[0];
                  if (code) {
                    try { sessionStorage.setItem('openRequestCode', code); } catch { /* ignore */ }
                    window.dispatchEvent(new CustomEvent('open-request', { detail: code }));
                  }
                  onOpenPage?.(n.target || (/REQUEST|DOCUMENT/i.test(String(n.type || '')) ? 'Requests' : 'Overview'));
                }}
              >
                <strong>{n.title}</strong>
                <span>{n.message}</span>
                <small>{n.type} · {n.createdAt ? new Date(n.createdAt).toLocaleString('en-GB') : ''}</small>
              </button>
            )) : <p className="empty-table">No notifications yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
