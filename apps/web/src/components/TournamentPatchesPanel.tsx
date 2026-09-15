import React, { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, Plus, Trash2, Upload, Save, Search, Check } from 'lucide-react';
import type { AppConfig, Product, ProductBadgeOption } from '../types';
import {
  DEFAULT_BADGE_PRICE_BDT,
  createDefaultBadgeOptions,
} from '../lib/productAddons';
import { uploadStoreImage, isLikelyImageFile } from '../lib/cloudinaryUpload';
import { confirmAsync, toast } from './UiFeedback';
import { api, isApiEnabled, getToken } from '../lib/apiClient';

interface TournamentPatchesPanelProps {
  appConfig: AppConfig;
  onUpdateConfig: (next: AppConfig | ((prev: AppConfig) => AppConfig)) => void;
  onRequireStaffLogin?: () => void;
  formatPrice: (amount: number) => string;
  /** Optional — enable patches on selected jerseys when publishing */
  products?: Product[];
  setProducts?: React.Dispatch<React.SetStateAction<Product[]>>;
  /** Tighter layout for product editor modal */
  compact?: boolean;
  /** Currently edited product id — keep in selected list by default */
  focusProductId?: string;
}

function clonePatches(list: ProductBadgeOption[]): ProductBadgeOption[] {
  return list.map((p, i) => ({
    id: p.id || `patch-${i + 1}`,
    label: p.label ?? '',
    priceBdt: Math.max(0, Math.round(Number(p.priceBdt) || 0)),
    ...(p.image ? { image: p.image } : {}),
  }));
}

/**
 * Global Tournament Patch catalog — upload images, set prices, add/edit/delete,
 * and optionally enable the catalog on selected products.
 */
export const TournamentPatchesPanel: React.FC<TournamentPatchesPanelProps> = ({
  appConfig,
  onUpdateConfig,
  onRequireStaffLogin,
  formatPrice,
  products,
  setProducts,
  compact = false,
  focusProductId,
}) => {
  const seed =
    Array.isArray(appConfig.tournamentPatches) && appConfig.tournamentPatches.length > 0
      ? clonePatches(appConfig.tournamentPatches)
      : createDefaultBadgeOptions();

  const [draft, setDraft] = useState<ProductBadgeOption[]>(seed);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (focusProductId) initial.add(focusProductId);
    return initial;
  });

  useEffect(() => {
    if (dirty) return;
    const next =
      Array.isArray(appConfig.tournamentPatches) && appConfig.tournamentPatches.length > 0
        ? clonePatches(appConfig.tournamentPatches)
        : createDefaultBadgeOptions();
    setDraft(next);
  }, [appConfig.tournamentPatches, dirty]);

  useEffect(() => {
    if (!focusProductId) return;
    setSelectedProductIds((prev) => {
      if (prev.has(focusProductId)) return prev;
      const next = new Set(prev);
      next.add(focusProductId);
      return next;
    });
  }, [focusProductId]);

  const filteredProducts = useMemo(() => {
    if (!products?.length) return [];
    const q = productQuery.trim().toLowerCase();
    const list = products.filter((p) => !p.isTrashed);
    if (!q) return list.slice(0, 40);
    return list
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q) ||
          (p.club || '').toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [products, productQuery]);

  const updateRow = (index: number, patch: Partial<ProductBadgeOption>) => {
    setDraft((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    setDirty(true);
  };

  const addRow = () => {
    setDraft((prev) => [
      ...prev,
      {
        id: `patch-${Date.now()}`,
        label: '',
        priceBdt: DEFAULT_BADGE_PRICE_BDT,
      },
    ]);
    setDirty(true);
  };

  const removeRow = async (index: number) => {
    const label = draft[index]?.label?.trim() || 'this patch';
    const ok = await confirmAsync({
      title: 'Remove patch?',
      message: `Remove “${label}” from the draft list? Click Update Patches to publish the change everywhere.`,
      confirmText: 'Remove',
      cancelText: 'Keep',
      danger: true,
    });
    if (!ok) return;
    setDraft((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const uploadImage = async (index: number, file: File) => {
    if (isApiEnabled() && !getToken()) {
      onRequireStaffLogin?.();
      toast('Staff sign-in required to upload patch images.', 'error');
      return;
    }
    if (!isLikelyImageFile(file)) {
      toast('Please choose an image (JPG, PNG, WEBP).', 'error');
      return;
    }
    const row = draft[index];
    if (!row) return;
    setUploadingId(row.id);
    try {
      const url = await uploadStoreImage(file, 'patches', {
        maxEdge: 480,
        quality: 0.88,
        maxBytes: 320_000,
      });
      updateRow(index, { image: url });
      toast('Patch image ready — click Update Patches to publish', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to upload patch image', 'error');
    } finally {
      setUploadingId(null);
    }
  };

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      filteredProducts.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const clearProductSelection = () => {
    setSelectedProductIds(() => {
      const next = new Set<string>();
      if (focusProductId) next.add(focusProductId);
      return next;
    });
  };

  const enablePatchesOnSelectedProducts = async (patchCatalog: ProductBadgeOption[]) => {
    if (!setProducts || selectedProductIds.size === 0) return 0;
    const ids = Array.from(selectedProductIds);
    let updatedCount = 0;

    if (isApiEnabled() && getToken()) {
      await Promise.all(
        ids.map(async (id) => {
          try {
            await api.updateProduct(id, {
              badgeAvailable: true,
              badgeOptions: patchCatalog,
            });
            updatedCount += 1;
          } catch (err) {
            console.error('Failed to enable patches on product', id, err);
          }
        }),
      );
    } else {
      updatedCount = ids.length;
    }

    setProducts((prev) =>
      prev.map((p) =>
        selectedProductIds.has(p.id)
          ? { ...p, badgeAvailable: true, badgeOptions: patchCatalog }
          : p,
      ),
    );
    return updatedCount;
  };

  const publishPatches = async () => {
    const cleaned = draft
      .map((p, i) => ({
        id: p.id || `patch-${i + 1}`,
        label: (p.label || '').trim(),
        priceBdt: Math.max(0, Math.round(Number(p.priceBdt) || 0)),
        ...(p.image?.trim() ? { image: p.image.trim() } : {}),
      }))
      .filter((p) => p.label.length > 0);

    if (cleaned.length === 0) {
      toast('Add at least one patch with a name before updating.', 'error');
      return;
    }

    setSaving(true);
    try {
      let normalized = cleaned;
      if (isApiEnabled()) {
        if (!getToken()) {
          onRequireStaffLogin?.();
          toast('Staff sign-in required to publish patches.', 'error');
          return;
        }
        const saved = await api.updateTournamentPatches(cleaned);
        const published = Array.isArray(saved?.tournamentPatches)
          ? (saved.tournamentPatches as ProductBadgeOption[])
          : cleaned;
        normalized = clonePatches(published);
      }

      onUpdateConfig((prev) => ({
        ...prev,
        tournamentPatches: normalized,
      }));
      setDraft(normalized);
      setDirty(false);

      const enabledCount = await enablePatchesOnSelectedProducts(normalized);
      toast(
        enabledCount > 0
          ? `Patches published · enabled on ${enabledCount} product${enabledCount === 1 ? '' : 's'}`
          : 'Tournament patches published for the storefront catalog',
        'success',
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update patches', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`bg-white border border-emerald-100 rounded-2xl shadow-sm ${
        compact ? 'p-4 space-y-3' : 'p-5 sm:p-6 space-y-4'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3
            className={`font-extrabold uppercase tracking-tight text-emerald-950 ${
              compact ? 'text-xs' : 'text-sm'
            }`}
          >
            Tournament Patch catalog
          </h3>
          <p className="text-[11px] text-emerald-700 mt-1 max-w-2xl leading-relaxed">
            Upload patch images, set names &amp; prices, add or remove options. Select products below to
            enable these patches for customers, then press <strong>Update Patches</strong>.
          </p>
        </div>
        {dirty ? (
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg shrink-0">
            Unpublished changes
          </span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg shrink-0">
            Live
          </span>
        )}
      </div>

      <div className="space-y-3">
        {draft.map((patch, index) => (
          <div
            key={patch.id || `patch-${index}`}
            className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 space-y-3"
          >
            <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
              <div className="flex items-center gap-3 shrink-0">
                <div className="h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem] rounded-xl border border-emerald-200 bg-white overflow-hidden flex items-center justify-center">
                  {patch.image ? (
                    <img
                      src={patch.image}
                      alt={patch.label || 'Patch'}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <ImageIcon size={20} className="text-emerald-400" />
                  )}
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <label className="relative inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-800 text-white text-[10px] font-bold uppercase cursor-pointer hover:bg-emerald-900 touch-manipulation overflow-hidden min-h-[40px]">
                    <Upload size={12} />
                    {uploadingId === patch.id ? 'Uploading…' : patch.image ? 'Change image' : 'Upload image'}
                    <input
                      type="file"
                      accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
                      className="absolute inset-0 z-[1] h-full w-full cursor-pointer opacity-0"
                      disabled={uploadingId === patch.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) void uploadImage(index, file);
                      }}
                    />
                  </label>
                  {patch.image ? (
                    <button
                      type="button"
                      onClick={() => updateRow(index, { image: undefined })}
                      className="text-[10px] font-bold uppercase text-emerald-800 hover:underline text-left cursor-pointer"
                    >
                      Clear image
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                <div>
                  <label className="font-bold text-emerald-950 block mb-1 text-[10px] uppercase tracking-wide">
                    Patch name
                  </label>
                  <input
                    type="text"
                    value={patch.label}
                    onChange={(e) => updateRow(index, { label: e.target.value })}
                    placeholder="e.g. WC 26"
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-emerald-950"
                  />
                </div>
                <div>
                  <label className="font-bold text-emerald-950 block mb-1 text-[10px] uppercase tracking-wide">
                    Price (৳ BDT)
                  </label>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={patch.priceBdt}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        updateRow(index, { priceBdt: 0 });
                        return;
                      }
                      updateRow(index, { priceBdt: Math.max(0, Number(raw) || 0) });
                    }}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-emerald-950"
                  />
                  <p className="text-[10px] text-emerald-600 mt-1">{formatPrice(patch.priceBdt)} add-on</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void removeRow(index)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 text-rose-700 text-[10px] font-bold uppercase hover:bg-rose-50 cursor-pointer touch-manipulation"
              >
                <Trash2 size={12} /> Delete patch
              </button>
            </div>
          </div>
        ))}
      </div>

      {products && setProducts ? (
        <div className="rounded-xl border border-emerald-100 bg-white p-3 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-emerald-950">
                Enable on products
              </p>
              <p className="text-[10px] text-emerald-700">
                Selected jerseys will offer these patches at checkout ({selectedProductIds.size} selected).
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={selectAllFiltered}
                className="px-2.5 py-1.5 rounded-lg border border-emerald-200 text-[10px] font-bold uppercase text-emerald-900 hover:bg-emerald-50 cursor-pointer"
              >
                Select shown
              </button>
              <button
                type="button"
                onClick={clearProductSelection}
                className="px-2.5 py-1.5 rounded-lg border border-emerald-200 text-[10px] font-bold uppercase text-emerald-900 hover:bg-emerald-50 cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600" />
            <input
              type="search"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder="Search product name, SKU, club…"
              className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl pl-9 pr-3 py-2 text-xs text-emerald-950"
            />
          </div>
          <div className="max-h-44 overflow-y-auto rounded-xl border border-emerald-100 divide-y divide-emerald-50">
            {filteredProducts.length === 0 ? (
              <p className="text-[11px] text-emerald-700 p-3 text-center">No products match.</p>
            ) : (
              filteredProducts.map((p) => {
                const on = selectedProductIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProduct(p.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-colors ${
                      on ? 'bg-emerald-50' : 'bg-white hover:bg-emerald-50/50'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded border shrink-0 ${
                        on ? 'bg-emerald-800 border-emerald-800 text-white' : 'border-emerald-300 bg-white'
                      }`}
                    >
                      {on ? <Check size={12} strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold text-emerald-950 truncate">{p.name}</span>
                      <span className="block text-[10px] font-mono text-emerald-600 truncate">
                        {p.sku || p.id}
                        {p.badgeAvailable === false ? ' · patches off' : ''}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 bg-white text-emerald-900 text-[11px] font-bold uppercase hover:bg-emerald-50 cursor-pointer touch-manipulation"
        >
          <Plus size={14} /> Add Patch
        </button>
        <button
          type="button"
          disabled={saving || (!dirty && selectedProductIds.size === 0)}
          onClick={() => void publishPatches()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-800 text-white text-[11px] font-bold uppercase hover:bg-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer touch-manipulation"
        >
          <Save size={14} />
          {saving ? 'Updating…' : 'Update Patches'}
        </button>
      </div>
    </div>
  );
};
