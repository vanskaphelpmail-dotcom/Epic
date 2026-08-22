'use client';

export default function CatalogPickField({
  label,
  value = '',
  options = [],
  onChange,
  onAdd,
  emptyLabel = 'Select…'
}) {
  const list = [];
  for (const item of options) {
    const name = String(item || '').trim();
    if (name && !list.includes(name)) list.push(name);
  }
  const current = String(value || '').trim();
  if (current && !list.includes(current)) list.unshift(current);

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
          <option value="">{emptyLabel}</option>
          {list.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
          <option value="__add__">+ Add new…</option>
        </select>
        <button type="button" className="btn" onClick={() => onAdd?.()}>Add</button>
      </div>
    </label>
  );
}
