import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import {
  filterDistrictGroups,
  findDistrictOption,
} from '../lib/bangladeshDistricts';

type DistrictSelectProps = {
  value: string;
  onChange: (district: string) => void;
  required?: boolean;
  id?: string;
  disabled?: boolean;
  className?: string;
};

export const DistrictSelect: React.FC<DistrictSelectProps> = ({
  value,
  onChange,
  required = false,
  id,
  disabled = false,
  className = '',
}) => {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(() => findDistrictOption(value), [value]);
  const groups = useMemo(() => filterDistrictGroups(query), [query]);
  const hasResults = groups.some((g) => g.districts.length > 0);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const pick = (district: string) => {
    onChange(district);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {/* Native required hook for form validation without free-text typing */}
      <input
        type="text"
        tabIndex={-1}
        aria-hidden
        required={required}
        value={value}
        onChange={() => undefined}
        className="sr-only absolute w-px h-px opacity-0 pointer-events-none"
      />

      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
          if (open) setQuery('');
        }}
        className={`w-full bg-[#F8F8F7] border-2 rounded-xl py-3 px-4 text-xs font-bold text-left flex items-center justify-between gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
          open
            ? 'border-[#E30613] bg-white'
            : 'border-[#E5E5E5] hover:border-[#E5E5E5] focus:border-[#E30613] focus:bg-white'
        } ${value ? 'text-[#0A0A0A]' : 'text-[#555555]'}`}
      >
        <span className="truncate">
          {selected ? selected.district : 'Select District'}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#555555] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-40 left-0 right-0 mt-1.5 bg-white border-2 border-[#E5E5E5] rounded-xl shadow-xl overflow-hidden"
        >
          <div className="p-2 border-b border-[#E5E5E5] bg-[#F8F8F7]">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555] pointer-events-none"
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search district..."
                className="w-full bg-white border border-[#E5E5E5] focus:border-[#E30613] rounded-lg py-2.5 pl-9 pr-3 text-xs font-bold text-[#0A0A0A] placeholder:text-[#555555] focus:outline-none"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto overscroll-contain py-1">
            {!hasResults ? (
              <p className="px-4 py-6 text-center text-xs font-mono text-[#555555]">
                No district found
              </p>
            ) : (
              groups.map((group) => (
                <div key={group.division} className="py-1">
                  <p className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#555555] sticky top-0 bg-white/95 backdrop-blur-sm">
                    {group.division}
                  </p>
                  <ul className="pb-1">
                    {group.districts.map((district) => {
                      const active = value.trim().toLowerCase() === district.toLowerCase();
                      return (
                        <li key={`${group.division}-${district}`}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={active}
                            onClick={() => pick(district)}
                            className={`w-full text-left px-4 py-2 text-xs font-bold flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                              active
                                ? 'bg-red-50 text-[#E30613]'
                                : 'text-[#0A0A0A] hover:bg-[#F8F8F7]'
                            }`}
                          >
                            <span className="truncate pl-1">{district}</span>
                            {active ? <Check size={14} className="shrink-0" /> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {selected && !open && (
        <p className="mt-1 text-[10px] font-mono text-[#555555]">{selected.division}</p>
      )}
    </div>
  );
};
