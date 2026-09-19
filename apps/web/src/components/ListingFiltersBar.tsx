import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { canonicalTargetPageName, storefrontLabelsMatch } from '../lib/storefrontPages';

export interface ListingFilterOptions {
  brands: string[];
  categories: string[];
  seasons: string[];
  clubs: string[];
  conditions: string[];
}

interface ListingFiltersBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedBrand: string;
  onBrandChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  selectedSeason: string;
  onSeasonChange: (value: string) => void;
  selectedClub: string;
  onClubChange: (value: string) => void;
  selectedCondition: string;
  onConditionChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  options: ListingFilterOptions;
  onReset: () => void;
}

function OptionButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-2 ${
        selected
          ? 'bg-[#0A0A0A] text-white font-bold'
          : 'hover:bg-[#F8F8F7] text-[#0A0A0A]'
      }`}
    >
      <span
        className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
          selected ? 'border-white bg-white' : 'border-[#D4D4D4] bg-white'
        }`}
        aria-hidden
      >
        {selected ? <span className="h-1.5 w-1.5 rounded-sm bg-[#0A0A0A]" /> : null}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

export const ListingFiltersBar: React.FC<ListingFiltersBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedBrand,
  onBrandChange,
  selectedCategory,
  onCategoryChange,
  selectedSeason,
  onSeasonChange,
  selectedClub,
  onClubChange,
  selectedCondition,
  onConditionChange,
  sortBy,
  onSortChange,
  options,
  onReset,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target || rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activeCount = useMemo(() => {
    let n = 0;
    if (selectedBrand !== 'All') n += 1;
    if (selectedCategory && selectedCategory !== 'All') n += 1;
    if (selectedSeason !== 'All') n += 1;
    if (selectedClub !== 'All') n += 1;
    if (selectedCondition !== 'All') n += 1;
    if (sortBy !== 'featured') n += 1;
    return n;
  }, [
    selectedBrand,
    selectedCategory,
    selectedSeason,
    selectedClub,
    selectedCondition,
    sortBy,
  ]);

  const chips = useMemo(() => {
    const list: Array<{ key: string; label: string; clear: () => void }> = [];
    if (selectedBrand !== 'All') {
      list.push({
        key: 'brand',
        label: selectedBrand,
        clear: () => onBrandChange('All'),
      });
    }
    if (selectedCategory && selectedCategory !== 'All') {
      list.push({
        key: 'category',
        label: canonicalTargetPageName(selectedCategory) || selectedCategory,
        clear: () => onCategoryChange('All'),
      });
    }
    if (selectedSeason !== 'All') {
      list.push({
        key: 'season',
        label: selectedSeason,
        clear: () => onSeasonChange('All'),
      });
    }
    if (selectedClub !== 'All') {
      list.push({
        key: 'club',
        label: selectedClub,
        clear: () => onClubChange('All'),
      });
    }
    if (selectedCondition !== 'All') {
      list.push({
        key: 'condition',
        label: selectedCondition,
        clear: () => onConditionChange('All'),
      });
    }
    return list;
  }, [
    selectedBrand,
    selectedCategory,
    selectedSeason,
    selectedClub,
    selectedCondition,
    onBrandChange,
    onCategoryChange,
    onSeasonChange,
    onClubChange,
    onConditionChange,
  ]);

  const pickAndClose = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="w-full space-y-3">
      <div className="flex items-stretch gap-2 sm:gap-3 w-full min-w-0">
        <label className="relative flex-1 min-w-0">
          <span className="sr-only">Search</span>
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555] pointer-events-none"
          />
          <input
            id="listing-search-input"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by club, jersey, SKU..."
            className="w-full h-11 sm:h-12 bg-white border border-[#E5E5E5] rounded-xl pl-9 pr-3 text-sm text-[#0A0A0A] placeholder:text-[#555555]/70 focus:outline-none focus:border-[#0A0A0A] focus:ring-1 focus:ring-[#0A0A0A]/10"
          />
        </label>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="dialog"
            className={`h-11 sm:h-12 inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 rounded-xl border text-xs sm:text-sm font-bold cursor-pointer transition-colors ${
              open || activeCount > 0
                ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                : 'bg-white text-[#0A0A0A] border-[#E5E5E5] hover:bg-[#F8F8F7]'
            }`}
          >
            <SlidersHorizontal size={15} />
            <span>Filters</span>
            {activeCount > 0 && (
              <span
                className={`min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-black inline-flex items-center justify-center ${
                  open || activeCount > 0
                    ? 'bg-white text-[#0A0A0A]'
                    : 'bg-[#0A0A0A] text-white'
                }`}
              >
                {activeCount}
              </span>
            )}
          </button>

          {open && (
            <div
              role="dialog"
              aria-label="Jersey filters"
              className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[min(100vw-2rem,22rem)] max-h-[min(70vh,32rem)] overflow-y-auto rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-xl"
            >
              <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-[#E5E5E5]">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#0A0A0A]">
                  Filters
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    onReset();
                    setOpen(false);
                  }}
                  className="text-[11px] font-bold text-[#555555] hover:text-[#0A0A0A] cursor-pointer"
                >
                  Clear all
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#555555]">
                    Brand
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-0.5 pr-0.5">
                    {options.brands.map((b) => (
                      <OptionButton
                        key={`brand-${b}`}
                        label={b}
                        selected={selectedBrand === b}
                        onClick={() => pickAndClose(() => onBrandChange(b))}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#555555]">
                    Category / League
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-0.5 pr-0.5">
                    {options.categories.map((cat) => {
                      const label = canonicalTargetPageName(cat) || cat;
                      const selected =
                        selectedCategory === cat ||
                        storefrontLabelsMatch(selectedCategory, cat);
                      return (
                        <OptionButton
                          key={`cat-${cat}`}
                          label={label}
                          selected={selected}
                          onClick={() => pickAndClose(() => onCategoryChange(cat))}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#555555]">
                    Season
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-0.5 pr-0.5">
                    {options.seasons.map((season) => (
                      <OptionButton
                        key={`season-${season}`}
                        label={season === 'All' ? 'All Seasons' : season}
                        selected={selectedSeason === season}
                        onClick={() => pickAndClose(() => onSeasonChange(season))}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#555555]">
                    Club / Team
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-0.5 pr-0.5">
                    {options.clubs.map((club) => (
                      <OptionButton
                        key={`club-${club}`}
                        label={club}
                        selected={selectedClub === club}
                        onClick={() => pickAndClose(() => onClubChange(club))}
                      />
                    ))}
                  </div>
                </div>

                {options.conditions.length > 1 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#555555]">
                      Condition
                    </p>
                    <div className="space-y-0.5">
                      {options.conditions.map((cond) => (
                        <OptionButton
                          key={`cond-${cond}`}
                          label={cond}
                          selected={selectedCondition === cond}
                          onClick={() => pickAndClose(() => onConditionChange(cond))}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 pt-1 border-t border-[#E5E5E5]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#555555]">
                    Sort
                  </p>
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      onSortChange(e.target.value);
                      setOpen(false);
                    }}
                    className="w-full bg-[#F8F8F7] border border-[#E5E5E5] rounded-xl py-2 px-3 text-[#0A0A0A] text-xs focus:outline-none focus:border-[#0A0A0A]"
                  >
                    <option value="featured">Featured</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="year-new">Year: Newest</option>
                    <option value="year-old">Year: Oldest</option>
                    <option value="rating">Top rated</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 text-[11px] font-bold text-[#0A0A0A] hover:bg-[#F8F8F7] cursor-pointer"
            >
              {chip.label}
              <X size={12} className="text-[#555555]" />
            </button>
          ))}
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] font-bold text-[#555555] hover:text-[#0A0A0A] px-1 cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};
