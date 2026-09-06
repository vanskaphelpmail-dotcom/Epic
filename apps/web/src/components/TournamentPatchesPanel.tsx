import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Plus, Trash2, Upload, Save } from 'lucide-react';
import type { AppConfig, ProductBadgeOption } from '../types';
import {
  DEFAULT_BADGE_PRICE_BDT,
  createDefaultBadgeOptions,
} from '../lib/productAddons';
import { uploadStoreImage } from '../lib/cloudinaryUpload';
import { confirmAsync, toast } from './UiFeedback';
import { api, isApiEnabled, getToken } from '../lib/apiClient';

interface TournamentPatchesPanelProps {
  appConfig: AppConfig;
  onUpdateConfig: (next: AppConfig | ((prev: AppConfig) => AppConfig)) => void;
  onRequireStaffLogin?: () => void;
  formatPrice: (amount: number) => string;
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
 * Global Tournament Patch catalog under Inventory — draft locally, then Update Patches.
 */
export const TournamentPatchesPanel: React.FC<TournamentPatchesPanelProps> = ({
  appConfig,
  onUpdateConfig,
  onRequireStaffLogin,
  formatPrice,
}) => {
  const seed =
    Array.isArray(appConfig.tournamentPatches) && appConfig.tournamentPatches.length > 0
      ? clonePatches(appConfig.tournamentPatches)
      : createDefaultBadgeOptions();

  const [draft, setDraft] = useState<ProductBadgeOption[]>(seed);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Sync from parent when saved config changes and local draft is clean
  useEffect(() => {
    if (dirty) return;
    const next =
      Array.isArray(appConfig.tournamentPatches) && appConfig.tournamentPatches.length > 0
        ? clonePatches(appConfig.tournamentPatches)
        : createDefaultBadgeOptions();
    setDraft(next);
  }, [appConfig.tournamentPatches, dirty]);

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
        const normalized = clonePatches(published);
        onUpdateConfig((prev) => ({
          ...prev,
          tournamentPatches: normalized,
        }));
        setDraft(normalized);
        setDirty(false);
        toast('Tournament patches published for all jerseys & customers', 'success');
        return;
      }

      onUpdateConfig((prev) => ({
        ...prev,
        tournamentPatches: cleaned,
      }));
      setDraft(clonePatches(cleaned));
      setDirty(false);
      toast('Tournament patches updated locally', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update patches', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-emerald-100 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-tight text-emerald-950">
            Tournament Patch catalog
          </h3>
          <p className="text-[11px] text-emerald-700 mt-1 max-w-2xl">
            Edit names (spaces allowed), prices, and images here. Press <strong>Update Patches</strong> to publish
            everywhere for all jerseys.
          </p>
        </div>
        {dirty ? (
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
            Unpublished changes
          </span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">
            Live
          </span>
        )}
      </div>

      <div className="space-y-3">
        {draft.map((patch, index) => (
          <div
            key={patch.id || `patch-${index}`}
            className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end rounded-xl border border-emerald-100 bg-emerald-50/30 p-3"
          >
            <div className="lg:col-span-3 flex items-center gap-3">
              <div className="h-16 w-16 rounded-xl border border-emerald-200 bg-white overflow-hidden flex items-center justify-center shrink-0">
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
                <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-800 text-white text-[10px] font-bold uppercase cursor-pointer hover:bg-emerald-900">
                  <Upload size={12} />
                  {uploadingId === patch.id ? 'Uploading…' : patch.image ? 'Change' : 'Upload'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
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

            <div className="lg:col-span-4">
              <label className="font-bold text-emerald-950 block mb-1 text-[10px] uppercase tracking-wide">
                Patch name
              </label>
              <input
                type="text"
                value={patch.label}
                onChange={(e) => updateRow(index, { label: e.target.value })}
                placeholder="e.g. WC 26"
                className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs font-semibold text-emerald-950"
              />
            </div>

            <div className="lg:col-span-3">
              <label className="font-bold text-emerald-950 block mb-1 text-[10px] uppercase tracking-wide">
                Price (৳ BDT)
              </label>
              <input
                type="number"
                min={0}
                value={patch.priceBdt}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    updateRow(index, { priceBdt: 0 });
                    return;
                  }
                  updateRow(index, { priceBdt: Math.max(0, Number(raw) || 0) });
                }}
                className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-950"
              />
              <p className="text-[10px] text-emerald-600 mt-1">{formatPrice(patch.priceBdt)} add-on</p>
            </div>

            <div className="lg:col-span-2">
              <button
                type="button"
                onClick={() => void removeRow(index)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-rose-200 text-rose-700 text-[10px] font-bold uppercase hover:bg-rose-50 cursor-pointer"
              >
                <Trash2 size={12} /> Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 bg-white text-emerald-900 text-[11px] font-bold uppercase hover:bg-emerald-50 cursor-pointer"
        >
          <Plus size={14} /> Add Patch Option
        </button>
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={() => void publishPatches()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-800 text-white text-[11px] font-bold uppercase hover:bg-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Save size={14} />
          {saving ? 'Updating…' : 'Update Patches'}
        </button>
      </div>
    </div>
  );
};
