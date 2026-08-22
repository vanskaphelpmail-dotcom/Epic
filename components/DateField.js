'use client';

import { useRef } from 'react';
import { formatUkDate } from '../lib/date-display';

export default function DateField({ value = '', onChange, required, allowClear, min, max, name }) {
  const nativeRef = useRef(null);
  const open = () => {
    const el = nativeRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.focus();
  };

  return (
    <div className="date-field">
      <input
        className="date-field-display"
        readOnly
        value={formatUkDate(value)}
        placeholder="DD/MM/YYYY"
        onClick={open}
        onFocus={open}
      />
      <input
        ref={nativeRef}
        className="date-field-native"
        type="date"
        name={name}
        required={required}
        min={min}
        max={max}
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
      />
      <button type="button" className="date-field-icon" aria-label="Open calendar" onClick={open}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>
      {allowClear && value ? (
        <button type="button" className="date-field-clear" onClick={() => onChange?.('')}>Clear</button>
      ) : null}
    </div>
  );
}
