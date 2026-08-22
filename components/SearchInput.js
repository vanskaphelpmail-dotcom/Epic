'use client';

export default function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  return (
    <input
      className="search-input"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
    />
  );
}
