'use client';

import { PERFUME_SIZE_OPTIONS, normalizePerfumeSize } from '../lib/perfume-sizes';

export default function SizeMlField({
  value,
  onChange,
  extraSizes = [],
  onAdd,
  label = 'Size (ml)'
}) {
  const current = normalizePerfumeSize(value);
  const options = [...new Set([...PERFUME_SIZE_OPTIONS, ...extraSizes.map(normalizePerfumeSize), current])];

  return (
    <label>
      {label}
      <div className="catalog-select-row">
        <select
          value={current}
          onChange={(e) => {
            if (e.target.value === '__add__') {
              onAdd?.();
              return;
            }
            onChange?.(e.target.value);
          }}
        >
          {options.map((ml) => (
            <option key={ml} value={ml}>{ml}</option>
          ))}
          <option value="__add__">+ Add new size…</option>
        </select>
        <button type="button" className="btn" onClick={() => onAdd?.()}>Add</button>
      </div>
    </label>
  );
}
