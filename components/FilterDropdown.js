'use client';

import { useEffect, useRef, useState } from 'react';

export default function FilterDropdown({ value, options = [], onChange, tone }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const selected = options.find((option) => option.value === value) || options[0];
  const isDefault = !selected || selected.value === options[0]?.value;

  useEffect(() => {
    const close = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className={`inv-filter ${open ? 'open' : ''} ${tone === 'solid' || !isDefault ? 'selected' : ''}`} ref={root}>
      <button
        type="button"
        className="inv-filter-btn"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label || 'Select'}</span>
        <span className="inv-filter-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="inv-filter-menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? 'is-active' : ''}
              onClick={() => {
                onChange?.(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
