'use client';

import { useEffect, useRef, useState } from 'react';

const STAFF_ACTIONS = [
  { id: 'view', label: 'View invoice' },
  { id: 'print', label: 'Print invoice' },
  { id: 'download', label: 'Download invoice' },
  { id: 'history', label: 'View history' }
];

const ADMIN_ACTIONS = [
  { id: 'view', label: 'View invoice' },
  { id: 'edit', label: 'Edit sale' },
  { id: 'recheck', label: 'Recheck sale' },
  { id: 'discount', label: 'Apply discount' },
  { id: 'exchange', label: 'Exchange product' },
  { id: 'return', label: 'Return product' },
  { id: 'refund', label: 'Refund customer' },
  { id: 'payment', label: 'Add payment' },
  { id: 'method', label: 'Update payment method' },
  { id: 'delete', label: 'Cancel sale' },
  { id: 'print', label: 'Print invoice' },
  { id: 'download', label: 'Download invoice' },
  { id: 'history', label: 'View history' }
];

export default function SaleActionsMenu({ sale, isAdmin, onAction }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const locked = ['VOID', 'REFUNDED'].includes(sale?.status);
  const actions = (isAdmin ? ADMIN_ACTIONS : STAFF_ACTIONS).filter((item) => {
    if (!isAdmin) return true;
    if (['edit', 'exchange', 'discount', 'method'].includes(item.id) && locked) return false;
    if (['return', 'refund', 'delete', 'payment'].includes(item.id) && sale?.status === 'VOID') return false;
    return true;
  });

  useEffect(() => {
    const close = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="sale-actions" ref={root}>
      <button type="button" className="btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Actions
      </button>
      {open && (
        <div className="sale-actions-menu" role="menu">
          {actions.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onAction?.(item.id, sale);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
