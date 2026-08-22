'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ROLE_PRESETS } from '../lib/permissions';
import {
  DATE_PERIOD_OPTIONS,
  formatDateInput,
  formatDateRangeLabel,
  resolvePeriod
} from '../lib/date-range';
import { REPORT_CARDS } from '../lib/report-catalog';
import { productImageOf } from '../lib/product-image';
import { normalizePerfumeSize } from '../lib/perfume-sizes';
import SizeMlField from './SizeMlField';
import CatalogPickField from './CatalogPickField';
import FilterDropdown from './FilterDropdown';
import DateField from './DateField';
import { monthName } from '../lib/date-display';
import SaleActionsMenu from './SaleActionsMenu';
import ReportDetails from './ReportDetails';
import EmployeeCards from './EmployeeCards';

const money = (n) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2
  }).format(Number(n || 0));

function downloadReport(path, period = 'thisMonth', from = '', to = '') {
  const params = new URLSearchParams({ period });
  if (period === 'custom' || (from && to)) {
    if (from) params.set('from', from);
    if (to) params.set('to', to);
  }
  const join = path.includes('?') ? '&' : '?';
  window.open(`${path}${join}${params.toString()}`, '_blank', 'noopener,noreferrer');
}

function isInLastMonth(dateValue) {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return d >= start && d <= end;
}

function AccessModuleGrid({ modules, selected, onToggle, disabled }) {
  return (
    <div className="access-grid">
      {(modules || []).map((mod) => {
        const checked = selected?.includes(mod.id);
        return (
          <label key={mod.id} className={`access-card ${checked ? 'on' : ''} ${disabled ? 'disabled' : ''}`}>
            <input
              type="checkbox"
              checked={!!checked}
              disabled={disabled}
              onChange={() => onToggle?.(mod.id)}
            />
            <div>
              <b>{mod.label}</b>
              <span>{mod.description}</span>
            </div>
          </label>
        );
      })}
    </div>
  );
}

function PeriodFilters({
  reportPeriod,
  setReportPeriod,
  reportFrom = '',
  reportTo = '',
  setReportFrom,
  setReportTo
}) {
  const range = resolvePeriod(
    reportPeriod,
    reportPeriod === 'custom' ? reportFrom : null,
    reportPeriod === 'custom' ? reportTo : null
  );
  const selectPeriod = (value) => {
    setReportPeriod(value);
    if (value === 'custom') {
      const fallback = resolvePeriod('thisMonth');
      if (!reportFrom) setReportFrom?.(formatDateInput(fallback.from));
      if (!reportTo) setReportTo?.(formatDateInput(fallback.to));
      return;
    }
    if (value === 'all') {
      setReportFrom?.('');
      setReportTo?.('');
      return;
    }
    const next = resolvePeriod(value);
    setReportFrom?.(formatDateInput(next.from));
    setReportTo?.(formatDateInput(next.to));
  };

  return (
    <div className="date-range-panel">
      <div className="filters date-range-presets">
        {DATE_PERIOD_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`chip ${reportPeriod === value ? 'active' : ''}`}
            onClick={() => selectPeriod(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="date-range-custom">
        <label>
          From
          <DateField
            value={reportFrom || formatDateInput(range.from)}
            onChange={(v) => {
              setReportFrom?.(v);
              setReportPeriod('custom');
            }}
          />
        </label>
        <label>
          To
          <DateField
            value={reportTo || formatDateInput(range.to)}
            onChange={(v) => {
              setReportTo?.(v);
              setReportPeriod('custom');
            }}
            min={reportFrom || undefined}
          />
        </label>
        <span className="date-range-label">
          {reportPeriod === 'all' ? 'All time' : formatDateRangeLabel(range.from, range.to)}
        </span>
      </div>
    </div>
  );
}

export default function WorkspaceModules({
  active,
  setActive,
  user,
  products,
  filtered,
  sales,
  staff,
  attendance,
  documents,
  salaries,
  query,
  setQuery,
  scanCode = '',
  setScanCode,
  onScanProduct,
  stockFilter,
  setStockFilter,
  productForm,
  setProductForm,
  staffForm,
  setStaffForm,
  docForm,
  setDocForm,
  salaryForm,
  setSalaryForm,
  showProductForm,
  setShowProductForm,
  editingProduct,
  setEditingProduct,
  reportPeriod = 'thisMonth',
  setReportPeriod,
  reportFrom = '',
  setReportFrom,
  reportTo = '',
  setReportTo,
  salesPeriod = 'all',
  setSalesPeriod,
  salesStaffFilter = '',
  setSalesStaffFilter,
  lastMonthSales,
  lastMonthOrderCount,
  lastMonthLabel,
  accessModules = [],
  editingAccessUser,
  setEditingAccessUser,
  onToggleStaffModule,
  onApplyStaffPreset,
  onStartEditAccess,
  onToggleEditModule,
  onSaveAccess,
  canSeeCost,
  brands = [],
  categories = [],
  extraSizes = [],
  catalogExtras = { supplier: [], dupe: [], notes: [], accords: [] },
  suppliers = [],
  onAddBrand,
  onAddCategory,
  onAddSize,
  onAddCatalog,
  onAddProduct,
  onEditProduct,
  onPrintBarcode,
  onReturnStock,
  onClock,
  onAddStaff,
  onAddDocument,
  onAddSalary,
  onSalaryFormChange,
  salaryPreview,
  onRefreshSalaryPreview,
  onEditSalary,
  onRecalculateSalary,
  onPaySalary,
  onLoadDemoHistory,
  onOpenInvoice,
  isAdmin,
  onSaleAction,
  toast,
  Icon
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reportType, setReportType] = useState(searchParams.get('type') || '');
  useEffect(() => {
    setReportType(searchParams.get('type') || '');
  }, [searchParams]);
  const openReport = (type) => {
    setReportType(type);
    router.push(`/reports?type=${encodeURIComponent(type)}`);
  };
  const closeReport = () => {
    setReportType('');
    router.push('/reports');
  };
  const productIdOf = (p) => p?.id || p?._id;
  const productStockOf = (p) => p?.stockQuantity ?? p?.quantity ?? 0;
  const productPriceOf = (p) => p?.sellingPrice ?? p?.price ?? 0;
  const productCostOf = (p) => p?.purchasePrice ?? p?.cost ?? 0;
  const productMinOf = (p) => p?.minimumStock ?? p?.lowStockThreshold ?? 5;
  const [docExport, setDocExport] = useState(null);
  const [stockGroup, setStockGroup] = useState('supplier');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [supplierFilter, setSupplierFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sizeFilter, setSizeFilter] = useState('All');
  const [dupeFilter, setDupeFilter] = useState('All');
  const [notesFilter, setNotesFilter] = useState('All');
  const [accordsFilter, setAccordsFilter] = useState('All');

  useEffect(() => {
    if (!docExport) return undefined;
    const [year, month] = String(docExport.month || '').split('-');
    const params = new URLSearchParams({ format: 'count' });
    if (year && month) {
      params.set('year', year);
      params.set('month', String(Number(month)));
    }
    if (docExport.directory) params.set('directory', docExport.directory);
    if (docExport.category) params.set('category', docExport.category);
    let cancelled = false;
    fetch(`/api/documents/export?${params.toString()}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled) return;
        setDocExport((prev) => (prev ? { ...prev, matchCount: payload?.data?.count ?? 0 } : prev));
      })
      .catch(() => {
        if (!cancelled) setDocExport((prev) => (prev ? { ...prev, matchCount: 0 } : prev));
      });
    return () => {
      cancelled = true;
    };
  }, [docExport?.month, docExport?.directory, docExport?.category, docExport?.format]);

  if (active === 'Inventory') {
    const supplierOf = (p) => p.supplierName || p.supplier?.name || 'No supplier';
    const categoryOf = (p) => p.category || 'Uncategorised';
    const unique = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const categoryNames = unique(filtered.map(categoryOf));
    const supplierNames = unique(filtered.map(supplierOf));
    const sizeNames = unique(filtered.map((p) => normalizePerfumeSize(p.size)));
    const dupeNames = unique(filtered.map((p) => p.dupe));
    const noteNames = unique(filtered.map((p) => p.notes));
    const accordNames = unique(filtered.map((p) => p.mainAccords));
    const listed = filtered.filter((p) => {
      if (categoryFilter !== 'All' && categoryOf(p) !== categoryFilter) return false;
      if (supplierFilter !== 'All' && supplierOf(p) !== supplierFilter) return false;
      if (sizeFilter !== 'All' && normalizePerfumeSize(p.size) !== sizeFilter) return false;
      if (dupeFilter !== 'All' && (p.dupe || '') !== dupeFilter) return false;
      if (notesFilter !== 'All' && (p.notes || '') !== notesFilter) return false;
      if (accordsFilter !== 'All' && (p.mainAccords || '') !== accordsFilter) return false;
      if (statusFilter === 'Active' && (p.isActive === false || productStockOf(p) === 0 || productStockOf(p) <= productMinOf(p))) return false;
      if (statusFilter === 'Low stock' && (p.isActive === false || productStockOf(p) === 0 || productStockOf(p) > productMinOf(p))) return false;
      if (statusFilter === 'Sold out' && productStockOf(p) !== 0) return false;
      return true;
    });
    const primary = stockGroup === 'none' ? null : supplierOf;
    const secondary = categoryOf;
    const grouped = [];
    if (primary) {
      const outer = new Map();
      for (const p of listed) {
        const a = primary(p);
        const b = secondary(p);
        if (!outer.has(a)) outer.set(a, new Map());
        const inner = outer.get(a);
        if (!inner.has(b)) inner.set(b, []);
        inner.get(b).push(p);
      }
      for (const [a, inner] of [...outer.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
        grouped.push({
          title: a,
          groups: [...inner.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([b, items]) => ({ title: b, items }))
        });
      }
    }
    const renderProductRow = (p) => {
      const healthy = productStockOf(p) > productMinOf(p);
      return (
        <div className="table-row" key={productIdOf(p)}>
          <div className="product-cell">
            {productImageOf(p) ? (
              <img src={productImageOf(p)} alt={p.name || ''} className="thumb" />
            ) : (
              <div className="thumb empty" />
            )}
            <div>
              <b>{p.name}</b>{p.isManualEntry ? <small className="badge pending">Manual · {p.reviewStatus || 'PENDING'}</small> : null}
              <small>{p.brand || '—'}</small>
              <small>Size {normalizePerfumeSize(p.size)}</small>
              <small className="sku-chip">{p.sku}</small>
            </div>
          </div>
          <span className="barcode-chip" title="Scan this barcode">{p.barcode || '—'}</span>
          <span>{p.category}</span>
          <span>{canSeeCost ? money(productCostOf(p)) : '—'}</span>
          <b>{money(productPriceOf(p))}</b>
          <span>{productStockOf(p)}</span>
          <span><small>{supplierOf(p)}</small><small>Updated {p.lastStockUpdatedAt ? new Date(p.lastStockUpdatedAt).toLocaleDateString('en-GB') : '—'}</small><small>Added {p.lastStockAddedAt ? new Date(p.lastStockAddedAt).toLocaleDateString('en-GB') : '—'}</small></span>
          <span className={`badge ${p.isActive === false ? 'cancelled' : healthy ? 'healthy' : productStockOf(p) === 0 ? 'cancelled' : 'warning'}`}>
            {p.isActive === false ? 'Inactive' : productStockOf(p) === 0 ? 'Sold out (0)' : healthy ? 'Active' : 'Low stock'}
          </span>
          <div className="row-actions">
            <button type="button" className="btn-text" onClick={() => onEditProduct?.(p)}>Edit</button>
            <button type="button" className="btn-text" onClick={() => onReturnStock?.(p)}>Return stock</button>
            <button type="button" className="btn-text" onClick={() => onPrintBarcode?.(p)}>Barcode</button>
          </div>
        </div>
      );
    };

    return (
      <section className="module panel">
        <div className="module-head">
          <div>
            <h2>Inventory</h2>
            <p>Stock, optional product images (max 500KB), date filters for exports, edit and barcode printing.</p>
          </div>
          <div className="header-actions">
            <button
              className="btn"
              onClick={() => downloadReport('/api/reports/stock/excel', reportPeriod, reportFrom, reportTo)}
            >
              Download stock
            </button>
            <button
              className="btn primary"
              onClick={() => {
                setEditingProduct?.(null);
                setShowProductForm((v) => !v);
              }}
            >
              <Icon name="plus" />
              <span>{editingProduct ? 'Editing…' : 'Add product'}</span>
            </button>
          </div>
        </div>

        <PeriodFilters
          reportPeriod={reportPeriod}
          setReportPeriod={setReportPeriod}
          reportFrom={reportFrom}
          reportTo={reportTo}
          setReportFrom={setReportFrom}
          setReportTo={setReportTo}
        />

        {showProductForm && (
          <form className="add-form" onSubmit={onAddProduct}>
            <div className="form-grid">
              <label>Product name<input required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></label>
              <label>
                Brand
                <div className="catalog-select-row">
                  <select
                    required
                    value={productForm.brand}
                    onChange={(e) => {
                      if (e.target.value === '__add__') {
                        onAddBrand?.();
                        return;
                      }
                      setProductForm({ ...productForm, brand: e.target.value });
                    }}
                  >
                    <option value="">Select brand…</option>
                    {brands.map((b) => (
                      <option key={b.id || b.name} value={b.name}>{b.name}</option>
                    ))}
                    {productForm.brand && !brands.some((b) => b.name === productForm.brand) && (
                      <option value={productForm.brand}>{productForm.brand}</option>
                    )}
                    <option value="__add__">+ Add new brand…</option>
                  </select>
                  <button type="button" className="btn" onClick={() => onAddBrand?.()}>Add</button>
                </div>
              </label>
              <label>
                Category
                <div className="catalog-select-row">
                  <select
                    required
                    value={productForm.category}
                    onChange={(e) => {
                      if (e.target.value === '__add__') {
                        onAddCategory?.();
                        return;
                      }
                      setProductForm({ ...productForm, category: e.target.value });
                    }}
                  >
                    <option value="">Select category…</option>
                    {categories.map((c) => (
                      <option key={c.id || c.name} value={c.name}>{c.name}</option>
                    ))}
                    {productForm.category && !categories.some((c) => c.name === productForm.category) && (
                      <option value={productForm.category}>{productForm.category}</option>
                    )}
                    <option value="__add__">+ Add new category…</option>
                  </select>
                  <button type="button" className="btn" onClick={() => onAddCategory?.()}>Add</button>
                </div>
              </label>
              <SizeMlField
                value={productForm.size}
                onChange={(size) => setProductForm({ ...productForm, size })}
                extraSizes={[...extraSizes, ...filtered.map((p) => normalizePerfumeSize(p.size))]}
                onAdd={onAddSize}
              />
              <CatalogPickField
                label="Supplier name"
                value={productForm.supplierName || ''}
                emptyLabel="Select supplier…"
                options={[
                  ...(catalogExtras.supplier || []),
                  ...suppliers.map((s) => s.name),
                  ...filtered.map((p) => p.supplierName || p.supplier?.name)
                ]}
                onChange={(supplierName) => setProductForm({ ...productForm, supplierName })}
                onAdd={() => onAddCatalog?.('supplier')}
              />
              <CatalogPickField
                label="Dupe"
                value={productForm.dupe || ''}
                emptyLabel="Select dupe…"
                options={[...(catalogExtras.dupe || []), ...filtered.map((p) => p.dupe)]}
                onChange={(dupe) => setProductForm({ ...productForm, dupe })}
                onAdd={() => onAddCatalog?.('dupe')}
              />
              <CatalogPickField
                label="Notes"
                value={productForm.notes || ''}
                emptyLabel="Select notes…"
                options={[...(catalogExtras.notes || []), ...filtered.map((p) => p.notes)]}
                onChange={(notes) => setProductForm({ ...productForm, notes })}
                onAdd={() => onAddCatalog?.('notes')}
              />
              <label>Season<select value={productForm.season || ''} onChange={(e) => setProductForm({ ...productForm, season: e.target.value })}><option value="">Select season…</option><option>Spring</option><option>Summer</option><option>Autumn</option><option>Winter</option><option>All Season</option></select></label>
              <CatalogPickField
                label="Main accords"
                value={productForm.mainAccords || ''}
                emptyLabel="Select accord…"
                options={['Woody', 'Amber', 'Floral', 'Fresh', 'Spicy', 'Sweet', 'Oud', 'Citrus', ...(catalogExtras.accords || []), ...filtered.map((p) => p.mainAccords)]}
                onChange={(mainAccords) => setProductForm({ ...productForm, mainAccords })}
                onAdd={() => onAddCatalog?.('accords')}
              />
              <div className="field-hint span-2">Seasons
                {['spring', 'summer', 'autumn', 'winter', 'allSeason'].map((season) => <label key={season} style={{ display: 'inline-flex', margin: '8px 12px 0 0', gap: 4 }}><input type="checkbox" checked={!!productForm[season]} onChange={(e) => setProductForm({ ...productForm, [season]: e.target.checked })} />{season === 'allSeason' ? 'All Season' : season[0].toUpperCase() + season.slice(1)}</label>)}
              </div>
              <label>Sell price (Â£)<input required type="number" step="0.01" min="0" value={productForm.sellingPrice} onChange={(e) => setProductForm({ ...productForm, sellingPrice: e.target.value })} /></label>
              <label>Cost (Â£)<input type="number" step="0.01" min="0" value={productForm.purchasePrice} onChange={(e) => setProductForm({ ...productForm, purchasePrice: e.target.value })} /></label>
              <label>Stock<input type="number" min="0" value={productForm.stockQuantity} onChange={(e) => setProductForm({ ...productForm, stockQuantity: e.target.value })} /></label>
              {user?.role === 'ADMIN' && <label>Product status<select value={productForm.isActive ? 'true' : 'false'} onChange={(e) => setProductForm({ ...productForm, isActive: e.target.value === 'true' })}><option value="true">Active — sellable in POS</option><option value="false">Inactive — hidden from POS</option></select></label>}
              {editingProduct ? (
                <>
                  <label>SKU<input value={productForm.sku || editingProduct.sku || ''} readOnly /></label>
                  <label>
                    Barcode (scan or type)
                    <input
                      value={productForm.barcode || editingProduct.barcode || ''}
                      onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value, autoBarcode: false })}
                      onBlur={async (e) => {
                        const code = e.target.value.trim();
                        if (!code) return;
                        try {
                          const r = await fetch(`/api/barcode/check?code=${encodeURIComponent(code)}&excludeId=${editingProduct.id || editingProduct._id || ''}`, { credentials: 'include' });
                          const p = await r.json();
                          if (p?.data && !p.data.available) alert(p.data.message);
                        } catch {
                          /* ignore */
                        }
                      }}
                      placeholder="Scan existing EAN/UPC or shop barcode"
                    />
                  </label>
                </>
              ) : (
                <label className="span-2">
                  <span className="field-hint">Barcode</span>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 0' }}>
                    <input
                      type="checkbox"
                      checked={productForm.autoBarcode !== false}
                      onChange={(e) => setProductForm({ ...productForm, autoBarcode: e.target.checked, barcode: e.target.checked ? '' : productForm.barcode })}
                    />
                    Generate unique barcode automatically
                  </label>
                  {productForm.autoBarcode === false && (
                    <input
                      value={productForm.barcode || ''}
                      onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                      onBlur={async (e) => {
                        const code = e.target.value.trim();
                        if (!code) return;
                        try {
                          const r = await fetch(`/api/barcode/check?code=${encodeURIComponent(code)}`, { credentials: 'include' });
                          const p = await r.json();
                          if (p?.data && !p.data.available) alert(p.data.message);
                        } catch {
                          /* ignore */
                        }
                      }}
                      placeholder="Scan or enter unique barcode"
                    />
                  )}
                </label>
              )}
              <label>
                Image (optional, max 500KB)
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setProductForm({ ...productForm, image: e.target.files?.[0] || null })}
                />
              </label>
            </div>
            <div className="header-actions">
              <button className="btn primary" type="submit">
                {editingProduct ? 'Update product' : 'Save product'}
              </button>
              {editingProduct && (
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setShowProductForm(false);
                  }}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        )}

        <form
          className="scan-bar toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            onScanProduct?.(scanCode || query, { add: false });
          }}
        >
          <input
            className="scan-input"
            value={scanCode}
            onChange={(e) => setScanCode?.(e.target.value)}
            placeholder="Scan barcode to find product…"
            autoComplete="off"
          />
          <button className="btn primary" type="submit">Find</button>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const q = query.trim();
                if (/^\d{6,}$/.test(q) || /^TOU-/i.test(q)) onScanProduct?.(q, { add: false });
              }
            }}
            placeholder="Search name, brand, SKU, barcode…"
          />
        </form>
        <div className="inv-filters">
          <FilterDropdown
            value={stockGroup}
            tone={stockGroup === 'supplier' ? 'solid' : undefined}
            onChange={setStockGroup}
            options={[
              { value: 'supplier', label: 'By supplier' },
              { value: 'none', label: 'Ungrouped' }
            ]}
          />
          <FilterDropdown
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'All', label: 'All statuses' },
              { value: 'Active', label: 'Active' },
              { value: 'Low stock', label: 'Low stock' },
              { value: 'Sold out', label: 'Sold out' }
            ]}
          />
          <FilterDropdown
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[{ value: 'All', label: 'All categories' }, ...categoryNames.map((name) => ({ value: name, label: name }))]}
          />
          <FilterDropdown
            value={supplierFilter}
            onChange={setSupplierFilter}
            options={[{ value: 'All', label: 'All suppliers' }, ...supplierNames.map((name) => ({ value: name, label: name }))]}
          />
          <FilterDropdown
            value={sizeFilter}
            onChange={setSizeFilter}
            options={[{ value: 'All', label: 'All sizes' }, ...sizeNames.map((name) => ({ value: name, label: name }))]}
          />
          <FilterDropdown
            value={dupeFilter}
            onChange={setDupeFilter}
            options={[{ value: 'All', label: 'All dupes' }, ...dupeNames.map((name) => ({ value: name, label: name }))]}
          />
          <FilterDropdown
            value={notesFilter}
            onChange={setNotesFilter}
            options={[{ value: 'All', label: 'All notes' }, ...noteNames.map((name) => ({ value: name, label: name }))]}
          />
          <FilterDropdown
            value={accordsFilter}
            onChange={setAccordsFilter}
            options={[{ value: 'All', label: 'All accords' }, ...accordNames.map((name) => ({ value: name, label: name }))]}
          />
        </div>
        <div className="data-table inventory-table">
          <div className="table-head">
            <span>Product</span>
            <span>Barcode</span>
            <span>Category</span>
            <span>Cost</span>
            <span>Sell</span>
            <span>Stock</span>
            <span>Supplier / stock dates</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {listed.length ? (
            stockGroup === 'none' ? listed.map(renderProductRow) : grouped.map((block) => (
            <div key={block.title} className="inventory-group">
              <div className="inventory-group-title">Supplier: {block.title} · {block.groups.reduce((n, g) => n + g.items.length, 0)}</div>
              {block.groups.map((inner) => (
                <div key={`${block.title}-${inner.title}`}>
                  <div className="inventory-group-sub">Category: {inner.title}</div>
                  {inner.items.map(renderProductRow)}
                </div>
              ))}
            </div>
            ))
          ) : <div className="empty-table">No products match your search.</div>}
        </div>
      </section>
    );
  }

  if (active === 'Sales') {
    const filteredSales =
      salesPeriod === 'last_month'
        ? sales.filter((s) => isInLastMonth(s.saleDate || s.createdAt))
        : sales;
    const periodTotal = filteredSales.reduce((sum, s) => sum + Number(s.total || 0), 0);

    return (
      <section className="module panel">
        <div className="module-head">
          <div>
            <h2>Sales</h2>
            <p>POS invoices · last month and all-time views</p>
          </div>
          <button className="btn" onClick={() => downloadReport('/api/reports/sales/excel', reportPeriod, reportFrom, reportTo)}>Download sales report</button>
        </div>
        <div className="stats" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <span>Last month sales</span>
            <strong>{money(lastMonthSales)}</strong>
            <small>{lastMonthOrderCount || 0} invoice(s) · {lastMonthLabel || 'previous month'}</small>
          </div>
          <div className="stat-card">
            <span>{salesPeriod === 'last_month' ? 'Filtered total' : 'Loaded total'}</span>
            <strong>{money(periodTotal)}</strong>
            <small>{filteredSales.length} invoice(s) shown</small>
          </div>
        </div>
        <div className="filters">
          {[
            ['all', 'All sales'],
            ['last_month', 'Last month']
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`chip ${salesPeriod === value ? 'active' : ''}`}
              onClick={() => setSalesPeriod?.(value)}
            >
              {label}
            </button>
          ))}
          {user?.role === 'ADMIN' && (
            <label className="chip" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              Employee
              <select
                value={salesStaffFilter}
                onChange={(e) => setSalesStaffFilter?.(e.target.value)}
              >
                <option value="">All employees</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <PeriodFilters
          reportPeriod={reportPeriod}
          setReportPeriod={setReportPeriod}
          reportFrom={reportFrom}
          reportTo={reportTo}
          setReportFrom={setReportFrom}
          setReportTo={setReportTo}
        />
        <div className="data-table orders-table">
          <div className="table-head">
            <span>Invoice</span><span>Customer</span><span>Staff</span><span>Total</span><span>Status</span><span>Actions</span>
          </div>
          {filteredSales.length ? filteredSales.map((s) => (
            <div className="table-row" key={s.id}>
              <div>
                <b>{s.invoiceNumber}</b>
                <small>{new Date(s.saleDate || s.createdAt).toLocaleString('en-GB')}</small>
              </div>
              <span>{s.customer?.name || 'Walk-in'}</span>
              <span>{s.staff?.name || '—'}</span>
              <b>{money(s.total)}</b>
              <button className="btn-text" onClick={() => onOpenInvoice(s)}>
                {s.status === 'VOID' ? 'CANCELLED' : (s.paymentStatus || s.status)}
              </button>
              <SaleActionsMenu sale={s} isAdmin={isAdmin} onAction={onSaleAction} />
            </div>
          )) : <div className="empty-table">No sales for this period.</div>}
        </div>
      </section>
    );
  }

  if (active === 'Attendance') {
    return (
      <section className="module panel">
        <div className="module-head">
          <div>
            <h2>Attendance</h2>
            <p>Clock in / out with current till balance carried forward</p>
          </div>
          <div className="header-actions">
            <button className="btn primary" onClick={onClock}>Clock in / out</button>
            <button className="btn" onClick={() => downloadReport('/api/reports/attendance/excel', reportPeriod, reportFrom, reportTo)}>Download attendance</button>
          </div>
        </div>
        <PeriodFilters
          reportPeriod={reportPeriod}
          setReportPeriod={setReportPeriod}
          reportFrom={reportFrom}
          reportTo={reportTo}
          setReportFrom={setReportFrom}
          setReportTo={setReportTo}
        />
        <EmployeeCards
          staff={isAdmin ? staff : staff.filter((s) => s.id === user?.id)}
          attendance={isAdmin ? attendance : attendance.filter((a) => (a.userId || a.user?.id) === user?.id)}
          salaries={[]}
          currentUser={user}
          canSeeAllStaff={isAdmin}
          showPayroll={false}
          reportFrom={reportFrom}
          reportTo={reportTo}
          onDownloadAttendance={() => downloadReport('/api/reports/attendance/excel', reportPeriod, reportFrom, reportTo)}
        />
      </section>
    );
  }

  if (active === 'Documents') {
    const now = new Date();
    const exportMonth = docExport?.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthChoices = Array.from({ length: 36 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
      return { value, label };
    });
    if (docExport) {
      const startExport = async (e) => {
        e.preventDefault();
        const [year, month] = (docExport.month || '').split('-');
        const params = new URLSearchParams({ format: docExport.format });
        if (year && month) {
          params.set('year', year);
          params.set('month', String(Number(month)));
        }
        if (docExport.directory) params.set('directory', docExport.directory);
        if (docExport.category) params.set('category', docExport.category);
        setDocExport((prev) => ({ ...prev, busy: true, status: `Preparing ${prev?.matchCount || ''} documents...`.replace(/\s+/g, ' ').trim() }));
        try {
          const res = await fetch(`/api/documents/export?${params.toString()}`, { credentials: 'include' });
          const contentType = res.headers.get('content-type') || '';
          if (!res.ok) {
            const payload = contentType.includes('json') ? await res.json().catch(() => ({})) : {};
            throw new Error(payload?.error?.message || payload?.message || 'Download failed');
          }
          const blob = await res.blob();
          const header = res.headers.get('content-disposition') || '';
          const match = header.match(/filename="([^"]+)"/);
          const filename = match?.[1] || 'documents.pdf';
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
          setDocExport((prev) => ({ ...prev, busy: false, status: 'Download complete' }));
          toast?.('Download complete');
        } catch (err) {
          setDocExport((prev) => ({ ...prev, busy: false, status: err.message }));
          toast?.(err.message);
        }
      };
      return (
        <section className="module panel">
          <div className="module-head">
            <div>
              <h2>Download documents</h2>
              <p>Selected filters → matching PDFs → download all as one file. Original uploads stay in Documents.</p>
            </div>
            <button className="btn" type="button" onClick={() => setDocExport(null)}>Back to documents</button>
          </div>
          <form className="add-form" onSubmit={startExport}>
            <div className="form-grid">
              <label>
                Month
                <select
                  value={docExport.month || ''}
                  onChange={(e) => setDocExport({ ...docExport, month: e.target.value, status: '' })}
                >
                  <option value="">All months</option>
                  {monthChoices.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Directory
                <select
                  value={docExport.directory || ''}
                  onChange={(e) => setDocExport({ ...docExport, directory: e.target.value, status: '' })}
                >
                  <option value="">All directories</option>
                  <option value="INVOICE">Invoice</option>
                  <option value="EMPLOYEE">Employee</option>
                  <option value="CONFUSED">Confused</option>
                  <option value="OTHERS">Others</option>
                </select>
              </label>
              <label>
                Category
                <select
                  value={docExport.category || ''}
                  onChange={(e) => setDocExport({ ...docExport, category: e.target.value, status: '' })}
                >
                  <option value="">All categories</option>
                  {[...new Set(['INVOICE', 'TAX', 'SUPPLIER_INVOICE', 'LETTER', 'DELIVERY_NOTE', 'RECEIPT', 'REPORT', 'OTHER', ...documents.map((d) => d.category)].filter(Boolean))].map((c) => (
                    <option key={c} value={c}>{String(c).replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="subhead">
              {typeof docExport.matchCount === 'number'
                ? (docExport.matchCount
                  ? `${docExport.matchCount} PDF document${docExport.matchCount === 1 ? '' : 's'} found`
                  : 'No PDF documents found for the selected filters.')
                : 'Counting matching PDFs…'}
            </p>
            {docExport.status ? <p className="subhead">{docExport.status}</p> : null}
            <button
              className="btn primary"
              type="submit"
              disabled={!!docExport.busy || docExport.matchCount === 0}
            >
              {docExport.busy ? 'Preparing download…' : `Download ${docExport.format === 'excel' ? 'Excel' : 'PDF'}`}
            </button>
          </form>
        </section>
      );
    }
    return (
      <section className="module panel">
        <div className="module-head">
          <div>
            <h2>Documents</h2>
            <p>Save PDFs into a directory, organised by month</p>
          </div>
          <div className="header-actions export-format-actions">
            <button className="btn" type="button" onClick={() => setDocExport({ format: 'pdf', month: exportMonth, directory: '', category: '' })}>
              Download PDF
            </button>
            <button className="btn" type="button" onClick={() => setDocExport({ format: 'excel', month: exportMonth, directory: '', category: '' })}>
              Download Excel
            </button>
          </div>
        </div>
        <form className="add-form" onSubmit={onAddDocument}>
          <div className="form-grid">
            <label>Title<input required value={docForm.title} onChange={(e) => setDocForm({ ...docForm, title: e.target.value })} /></label>
            <label>Category
              <select value={docForm.category} onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}>
                <option value="INVOICE">Invoice</option>
                <option value="TAX">Tax</option>
                <option value="SUPPLIER_INVOICE">Supplier Invoice</option>
                <option value="LETTER">Letter</option>
                <option value="DELIVERY_NOTE">Delivery Note</option>
                <option value="RECEIPT">Receipt</option>
                <option value="REPORT">Report</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label>Directory
              <select value={docForm.directory || 'INVOICE'} onChange={(e) => setDocForm({ ...docForm, directory: e.target.value })}>
                <option value="INVOICE">Invoice</option>
                <option value="EMPLOYEE">Employee</option>
                <option value="CONFUSED">Confused</option>
                <option value="OTHERS">Others</option>
              </select>
            </label>
            <label>Month
              <input
                type="month"
                value={`${docForm.periodYear || new Date().getFullYear()}-${String(docForm.periodMonth || new Date().getMonth() + 1).padStart(2, '0')}`}
                onChange={(e) => {
                  const [y, m] = (e.target.value || '').split('-');
                  setDocForm({ ...docForm, periodYear: Number(y), periodMonth: Number(m) });
                }}
              />
            </label>
            <label>PDF file
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setDocForm({ ...docForm, file: e.target.files?.[0] || null })}
              />
            </label>
          </div>
          <button className="btn primary" type="submit">Save to directory</button>
        </form>
        <div className="data-table">
          <div className="table-head"><span>Title</span><span>Directory</span><span>Month</span><span>By</span><span>File</span></div>
          {documents.length ? documents.map((d) => (
            <div className="table-row" key={d.id}>
              <b>{d.title}</b>
              <span>{d.directory || d.category}</span>
              <span>{d.periodYear && d.periodMonth ? monthName(d.periodYear, d.periodMonth) : '-'}</span>
              <span>{d.uploadedBy?.name || '-'}</span>
              <span>
                {d.localPath ? (
                  <a className="btn-text" href={d.localPath} target="_blank" rel="noreferrer">Open PDF</a>
                ) : '-'}
                {d.employeeId ? <small> · employee file</small> : null}
              </span>
            </div>
          )) : <div className="empty-table">No documents yet.</div>}
        </div>
      </section>
    );
  }

  if (active === 'Payroll') {
    const periodLabel = (row) => {
      const a = new Date(row.periodStart).toLocaleDateString('en-GB');
      const b = new Date(row.periodEnd).toLocaleDateString('en-GB');
      return `${a} – ${b}`;
    };

    return (
      <section className="module panel">
        <div className="module-head">
          <div>
            <h2>Payroll</h2>
            <p>User-wise salary · auto from clock in/out · weekly or monthly · pay full or partial</p>
          </div>
          {isAdmin && (
            <button className="btn" onClick={() => downloadReport('/api/reports/salary/excel', reportPeriod, reportFrom, reportTo)}>Download all payroll</button>
          )}
        </div>
        <PeriodFilters
          reportPeriod={reportPeriod}
          setReportPeriod={setReportPeriod}
          reportFrom={reportFrom}
          reportTo={reportTo}
          setReportFrom={setReportFrom}
          setReportTo={setReportTo}
        />

        {isAdmin && (
        <form className="add-form" onSubmit={onAddSalary}>
          <h3 className="section-title">Create salary from attendance</h3>
          <div className="filters" style={{ marginBottom: 12 }}>
            {[
              ['week', 'Weekly'],
              ['month', 'Monthly']
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`chip ${salaryForm.periodType === value ? 'active' : ''}`}
                onClick={() => onSalaryFormChange?.({ periodType: value })}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="form-grid">
            <label>Employee
              <select
                required
                value={salaryForm.userId}
                onChange={(e) => onSalaryFormChange?.({ userId: e.target.value })}
              >
                <option value="">Select…</option>
                {staff.filter((s) => s.role !== 'ADMIN').map((s) => (
                  <option key={s.id} value={s.id}>{s.name} · {s.employeeId}</option>
                ))}
              </select>
            </label>
            <label>
              Period date (any day in {salaryForm.periodType === 'week' ? 'week' : 'month'})
              <DateField
                value={salaryForm.periodAnchor}
                onChange={(v) => onSalaryFormChange?.({ periodAnchor: v })}
              />
            </label>
            <label>
              {salaryForm.periodType === 'week' ? 'Weekly base (£)' : 'Monthly base (£)'}
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={salaryForm.baseSalary}
                onChange={(e) => onSalaryFormChange?.({ baseSalary: e.target.value })}
              />
            </label>
            <label>
              Expected hours
              <input
                type="number"
                min="1"
                step="0.5"
                value={salaryForm.expectedHours}
                onChange={(e) => onSalaryFormChange?.({ expectedHours: e.target.value })}
              />
            </label>
            <label>
              Clock days
              <input type="number" readOnly value={salaryForm.workingDays} />
            </label>
            <label>
              Clock hours
              <input type="number" readOnly value={salaryForm.workingHours} />
            </label>
            <label>
              Calculated salary (Â£)
              <input
                type="number"
                min="0"
                step="0.01"
                value={salaryForm.calculatedSalary}
                onChange={(e) => setSalaryForm({ ...salaryForm, calculatedSalary: e.target.value })}
              />
            </label>
            <label>
              Paid now (Â£)
              <input
                type="number"
                min="0"
                step="0.01"
                value={salaryForm.paidAmount}
                onChange={(e) => setSalaryForm({ ...salaryForm, paidAmount: e.target.value })}
              />
            </label>
          </div>
          {salaryPreview && (
            <div
              className={`hint-box ${Number(salaryPreview.workingHours || 0) > 0 ? 'ok' : 'warn'}`}
              style={{ marginTop: 12 }}
            >
              {salaryPreview.user?.name}: {salaryPreview.workingDays} day(s), {salaryPreview.workingHours}h
              from clock → calculated {money(salaryPreview.calculatedSalary)}
              {' '}({new Date(salaryPreview.periodStart).toLocaleDateString('en-GB')} – {new Date(salaryPreview.periodEnd).toLocaleDateString('en-GB')})
              {Number(salaryPreview.workingHours || 0) <= 0 && (
                <> · No clock hours yet — see PENDING dummy salary below, or load demo attendance from Reports.</>
              )}
            </div>
          )}
          <div className="header-actions" style={{ marginTop: 14 }}>
            <button className="btn" type="button" onClick={() => onRefreshSalaryPreview?.()}>
              Recalc from clock
            </button>
            <button className="btn primary" type="submit">Save salary record</button>
          </div>
        </form>
        )}

        <EmployeeCards
          staff={isAdmin ? staff : staff.filter((s) => s.id === user?.id)}
          attendance={isAdmin ? attendance : attendance.filter((a) => (a.userId || a.user?.id) === user?.id)}
          salaries={isAdmin ? salaries : []}
          currentUser={user}
          canSeeAllStaff={isAdmin}
          showPayroll={isAdmin}
          reportFrom={reportFrom}
          reportTo={reportTo}
          onPaySalary={onPaySalary}
          onRecalculateSalary={onRecalculateSalary}
          onEditSalary={onEditSalary}
          onDownloadAttendance={() => downloadReport('/api/reports/attendance/excel', reportPeriod, reportFrom, reportTo)}
          onDownloadPayroll={isAdmin ? () => downloadReport('/api/reports/salary/excel', reportPeriod, reportFrom, reportTo) : undefined}
        />
      </section>
    );
  }

  if (active === 'Team & Roles') {
    const moduleLabel = (id) => accessModules.find((m) => m.id === id)?.label || id;

    return (
      <section className="module panel">
        <div className="module-head">
          <div>
            <h2>Team & Roles</h2>
            <p>Create users and assign module access (sales, attendance, payroll, reports…)</p>
          </div>
        </div>

        <form className="add-form" onSubmit={onAddStaff}>
          <h3 className="section-title">Create staff user</h3>
          <div className="form-grid">
            <label>Name<input required value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} /></label>
            <label>Email<input required type="email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} /></label>
            <label>Employee ID<input required value={staffForm.employeeId} onChange={(e) => setStaffForm({ ...staffForm, employeeId: e.target.value })} /></label>
            <label>Password<input required value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} /></label>
            <label>Role preset
              <select
                value={staffForm.preset}
                onChange={(e) => onApplyStaffPreset?.(e.target.value)}
              >
                {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>{preset.label}</option>
                ))}
              </select>
            </label>
          </div>

          <h3 className="section-title">Access management</h3>
          <p className="subhead">Tick the modules this user can view and use.</p>
          <AccessModuleGrid
            modules={accessModules}
            selected={staffForm.modules || []}
            onToggle={onToggleStaffModule}
          />
          <button className="btn primary" type="submit" style={{ marginTop: 14 }}>Create staff user</button>
        </form>

        <div className="module-head" style={{ marginTop: 28 }}>
          <div>
            <h3 className="section-title">Team access overview</h3>
            <p className="subhead">{staff.length} users · edit staff access and passwords (admin excluded)</p>
          </div>
        </div>
        <div className="team-access-list">
          {staff.map((s) => {
            const canEditModules = s.role !== 'ADMIN';
            return (
              <div className="team-access-card" key={s.id}>
                <div className="team-access-main">
                  <div>
                    <b>{s.name}</b>
                    <small>{s.email}</small>
                  </div>
                  <div className="team-access-meta">
                    <span>{s.employeeId}</span>
                    <span className="badge pending">{s.role}</span>
                    <span className={`badge ${s.isActive ? 'paid' : 'cancelled'}`}>
                      {s.isActive ? 'Active' : 'Off'}
                    </span>
                  </div>
                </div>
                <div className="access-tags">
                  {(s.modules || []).length
                    ? (s.modules || []).map((id) => (
                        <span className="chip active" key={id}>{moduleLabel(id)}</span>
                      ))
                    : <span className="chip">{canEditModules ? 'No modules' : 'Full admin access'}</span>}
                </div>
                <div className="team-access-actions">
                  {canEditModules ? (
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => onStartEditAccess?.(s)}
                    >
                      Edit access
                    </button>
                  ) : (
                    <span className="subhead">Full admin access</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {editingAccessUser && editingAccessUser.role !== 'ADMIN' && (
          <div className="invoice-overlay" onClick={() => setEditingAccessUser?.(null)}>
            <div className="invoice-card access-modal billing-modal" onClick={(e) => e.stopPropagation()}>
              <h2>Edit access · {editingAccessUser.name}</h2>
              <p className="modal-sub">{editingAccessUser.employeeId} · {editingAccessUser.email}</p>

              <div className="section-block">
                <h3>Password (optional)</h3>
                <div className="field-grid">
                  <label className="full">
                    New password
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Leave blank to keep current"
                      value={editingAccessUser.password || ''}
                      onChange={(e) =>
                        setEditingAccessUser?.((prev) =>
                          prev ? { ...prev, password: e.target.value } : prev
                        )
                      }
                    />
                  </label>
                  <label className="full">
                    Confirm new password
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Re-type new password"
                      value={editingAccessUser.passwordConfirm || ''}
                      onChange={(e) =>
                        setEditingAccessUser?.((prev) =>
                          prev ? { ...prev, passwordConfirm: e.target.value } : prev
                        )
                      }
                    />
                  </label>
                </div>
              </div>

              <p className="subhead" style={{ margin: '16px 0 12px' }}>
                Tick modules this user can view and use, then save.
              </p>
              <div className="filters" style={{ marginBottom: 12 }}>
                {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    className="chip"
                    onClick={() =>
                      setEditingAccessUser?.((prev) =>
                        prev ? { ...prev, modules: [...preset.modules] } : prev
                      )
                    }
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <AccessModuleGrid
                modules={accessModules}
                selected={editingAccessUser.modules || []}
                onToggle={onToggleEditModule}
              />

              <div className="invoice-actions">
                <button className="btn" type="button" onClick={() => setEditingAccessUser?.(null)}>Cancel</button>
                <button className="btn primary" type="button" onClick={onSaveAccess}>
                  Save access
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  if (active === 'Reports') {
    const periodFilters = (
      <PeriodFilters
        reportPeriod={reportPeriod}
        setReportPeriod={setReportPeriod}
        reportFrom={reportFrom}
        reportTo={reportTo}
        setReportFrom={setReportFrom}
        setReportTo={setReportTo}
      />
    );
    if (reportType) {
      return (
        <ReportDetails
          type={reportType}
          PeriodFilters={periodFilters}
          reportPeriod={reportPeriod}
          setReportPeriod={setReportPeriod}
          reportFrom={reportFrom}
          setReportFrom={setReportFrom}
          reportTo={reportTo}
          setReportTo={setReportTo}
          onBack={closeReport}
          toast={toast}
        />
      );
    }
    return (
      <section className="module panel">
        <div className="module-head">
          <div>
            <h2>Reports & Analytics</h2>
            <p>Choose a date range, then click a card to open that report. Export PDF or Excel from the report page.</p>
          </div>
          {user?.role === 'ADMIN' && (
            <button className="btn primary" type="button" onClick={() => onLoadDemoHistory?.()}>
              Load 7-day demo history
            </button>
          )}
        </div>
        {periodFilters}
        <div className="report-grid">
          {REPORT_CARDS.map((card) => (
            <button
              type="button"
              className="report-card"
              key={card.type}
              onClick={() => openReport(card.type)}
            >
              <b>{card.title}</b>
              <span>{resolvePeriod(reportPeriod, reportFrom, reportTo).label}</span>
              <small>{card.hint}</small>
              <em>View report →</em>
            </button>
          ))}
        </div>
        <p className="subhead" style={{ marginTop: 16 }}>
          3-year archive uses January of two years ago through today. Signed in as {user?.name} ({user?.role}).
        </p>
      </section>
    );
  }

  return (
    <section className="module panel">
      <div className="module-head">
        <div>
          <h2>{active}</h2>
          <p>{products.length} products loaded · The Ouds Cardiff</p>
        </div>
      </div>
      <div className="empty-module">
        <div className="large-icon"><Icon name="overview" /></div>
        <h3>{active}</h3>
        <p>Use Inventory, Sales, Attendance, Documents, Payroll, Team & Roles, or Reports from the sidebar.</p>
      </div>
    </section>
  );
}
