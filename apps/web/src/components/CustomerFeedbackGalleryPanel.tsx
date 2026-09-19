import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Plus,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import type { AppConfig, CommunityGalleryConfig, CommunityGalleryImage } from '../types';
import {
  DEFAULT_CUSTOMER_FEEDBACK_GALLERY,
  normalizeCustomerFeedbackGallery,
} from '../lib/customerFeedbackGallery';
import {
  uploadStoreImage,
  isLikelyImageFile,
  formatUploadError,
  IMAGE_FILE_ACCEPT,
  MOBILE_UPLOAD_COMPRESS,
} from '../lib/cloudinaryUpload';
import { confirmAsync, toast } from './UiFeedback';
import { api, isApiEnabled, getToken } from '../lib/apiClient';

type CustomerFeedbackGalleryConfig = CommunityGalleryConfig;
type CustomerFeedbackImage = CommunityGalleryImage;

interface CustomerFeedbackGalleryPanelProps {
  appConfig: AppConfig;
  onUpdateConfig: (next: AppConfig | ((prev: AppConfig) => AppConfig)) => void;
  onRequireStaffLogin?: () => void;
}

function cloneGallery(cfg: CustomerFeedbackGalleryConfig): CustomerFeedbackGalleryConfig {
  return {
    ...cfg,
    images: cfg.images.map((img, i) => ({
      ...img,
      sortOrder: i,
    })),
  };
}

function cleanGallery(draft: CustomerFeedbackGalleryConfig): CustomerFeedbackGalleryConfig {
  return cloneGallery({
    title: draft.title.trim() || DEFAULT_CUSTOMER_FEEDBACK_GALLERY.title,
    membersLabel: draft.membersLabel.trim() || DEFAULT_CUSTOMER_FEEDBACK_GALLERY.membersLabel,
    subtitle: draft.subtitle.trim() || DEFAULT_CUSTOMER_FEEDBACK_GALLERY.subtitle,
    facebookUrl: draft.facebookUrl.trim() || '',
    enabled: draft.enabled !== false,
    images: draft.images
      .filter((img) => !!img.imageUrl?.trim())
      .map((img, i) => ({
        ...img,
        imageUrl: img.imageUrl.trim(),
        title: (img.title || '').trim() || undefined,
        status: img.status === 'Inactive' ? 'Inactive' : 'Active',
        sortOrder: i,
      })),
  });
}

export const CustomerFeedbackGalleryPanel: React.FC<CustomerFeedbackGalleryPanelProps> = ({
  appConfig,
  onUpdateConfig,
  onRequireStaffLogin,
}) => {
  const [draft, setDraft] = useState<CustomerFeedbackGalleryConfig>(() =>
    cloneGallery(normalizeCustomerFeedbackGallery(appConfig.customerFeedbackGallery)),
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (dirty) return;
    setDraft(cloneGallery(normalizeCustomerFeedbackGallery(appConfig.customerFeedbackGallery)));
  }, [appConfig.customerFeedbackGallery, dirty]);

  const patchDraft = (next: CustomerFeedbackGalleryConfig) => {
    setDraft(next);
    setDirty(true);
  };

  const updateImage = (id: string, patch: Partial<CustomerFeedbackImage>) => {
    const next = {
      ...draftRef.current,
      images: draftRef.current.images.map((img) =>
        img.id === id ? { ...img, ...patch } : img,
      ),
    };
    patchDraft(next);
    return next;
  };

  const moveImage = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= draft.images.length) return;
    const next = [...draft.images];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    patchDraft({
      ...draft,
      images: next.map((img, i) => ({ ...img, sortOrder: i })),
    });
  };

  const removeImage = async (id: string) => {
    const ok = await confirmAsync('Remove this feedback image?');
    if (!ok) return;
    patchDraft({
      ...draft,
      images: draft.images
        .filter((img) => img.id !== id)
        .map((img, i) => ({ ...img, sortOrder: i })),
    });
  };

  const addBlank = () => {
    const id = `feedback-${Date.now()}`;
    patchDraft({
      ...draft,
      images: [
        ...draft.images,
        {
          id,
          imageUrl: '',
          title: `Feedback ${draft.images.length + 1}`,
          status: 'Active',
          sortOrder: draft.images.length,
          size: 'lg',
        },
      ],
    });
  };

  const resetDefaults = async () => {
    const ok = await confirmAsync('Reset customers feedback gallery to default seed images?');
    if (!ok) return;
    patchDraft(cloneGallery(DEFAULT_CUSTOMER_FEEDBACK_GALLERY));
  };

  const persistGallery = async (gallery: CustomerFeedbackGalleryConfig, silent = false) => {
    const cleaned = cleanGallery(gallery);
    if (cleaned.images.length === 0) {
      toast('Add at least one image before saving.', 'error');
      return false;
    }

    if (isApiEnabled()) {
      if (!getToken()) {
        onRequireStaffLogin?.();
        toast('Staff sign-in required to publish.', 'error');
        return false;
      }
      const saved = await api.updateCustomerFeedbackGallery(cleaned);
      const published = normalizeCustomerFeedbackGallery(
        (saved as { customerFeedbackGallery?: unknown })?.customerFeedbackGallery ?? cleaned,
      );
      onUpdateConfig((prev) => ({
        ...prev,
        customerFeedbackGallery: published,
      }));
      setDraft(published);
      setDirty(false);
      if (!silent) toast('Customers feedback published to storefront', 'success');
      return true;
    }

    onUpdateConfig((prev) => ({
      ...prev,
      customerFeedbackGallery: cleaned,
    }));
    setDraft(cleaned);
    setDirty(false);
    if (!silent) toast('Customers feedback saved', 'success');
    return true;
  };

  const uploadFor = async (id: string, file: File) => {
    if (!isLikelyImageFile(file)) {
      toast('Please choose an image file (JPG, PNG, WEBP).', 'error');
      return;
    }
    if (isApiEnabled() && !getToken()) {
      onRequireStaffLogin?.();
      toast('Staff sign-in required to upload.', 'error');
      return;
    }

    setUploadingId(id);
    try {
      const url = await uploadStoreImage(file, 'media', MOBILE_UPLOAD_COMPRESS);
      const next = updateImage(id, {
        imageUrl: url,
        status: 'Active',
      });
      toast('Image uploaded — publishing…', 'success');
      setSaving(true);
      await persistGallery(next, true);
      toast('Image live on storefront', 'success');
    } catch (err) {
      toast(formatUploadError(err), 'error');
    } finally {
      setUploadingId(null);
      setSaving(false);
    }
  };

  const publish = async () => {
    setSaving(true);
    try {
      await persistGallery(draft);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save customers feedback gallery', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-5 sm:p-6 space-y-5 animate-fadeIn">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-950 flex items-center gap-2">
            <ImageIcon size={16} className="text-zinc-700" />
            Customers Feedback
          </h2>
          <p className="text-[12px] text-zinc-600 mt-1 max-w-xl font-medium">
            Manage Customers Feedback — upload buyer photos for the storefront carousel.
            Shows on all pages, before the Outlets section.
            Changes publish to the storefront before Outlets.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void resetDefaults()}
            className="px-3 py-2 rounded-xl border border-zinc-200 text-[10px] font-black uppercase tracking-wider text-zinc-800 hover:bg-zinc-50 cursor-pointer"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => void publish()}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-950 text-white text-[10px] font-black uppercase tracking-wider disabled:opacity-50 cursor-pointer hover:bg-black"
          >
            <Save size={13} />
            {saving ? 'Saving…' : 'Publish to storefront'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex items-center gap-3 md:col-span-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.enabled !== false}
            onChange={(e) => patchDraft({ ...draft, enabled: e.target.checked })}
            className="h-4 w-4 accent-zinc-950"
          />
          <span className="text-xs font-bold text-zinc-950">
            Show on storefront (all pages, before Outlets)
          </span>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Section Title
          </span>
          <input
            value={draft.title}
            onChange={(e) => patchDraft({ ...draft, title: e.target.value })}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-950 focus:outline-none focus:border-zinc-950"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Members
          </span>
          <input
            value={draft.membersLabel}
            onChange={(e) => patchDraft({ ...draft, membersLabel: e.target.value })}
            placeholder="+6,783"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-950 focus:outline-none focus:border-zinc-950"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Member Subtitle
          </span>
          <input
            value={draft.subtitle}
            onChange={(e) => patchDraft({ ...draft, subtitle: e.target.value })}
            placeholder="Members Since 2024."
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-950 focus:outline-none focus:border-zinc-950"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Optional link URL
          </span>
          <input
            value={draft.facebookUrl}
            onChange={(e) => patchDraft({ ...draft, facebookUrl: e.target.value })}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-950 focus:outline-none focus:border-zinc-950"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-zinc-200 pt-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Carousel images ({draft.images.length})
          </p>
          <p className="text-[11px] text-zinc-600 mt-0.5">
            Each slot is one storefront photo — upload or replace individually.
          </p>
        </div>
        <button
          type="button"
          onClick={addBlank}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 text-[10px] font-black uppercase tracking-wider text-zinc-900 hover:bg-zinc-50 cursor-pointer"
        >
          <Plus size={13} /> Add image
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {draft.images.map((img, index) => (
          <div
            key={img.id}
            className="rounded-2xl border border-zinc-200 bg-zinc-50/60 overflow-hidden flex flex-col"
          >
            <div className="relative aspect-[3/4] bg-zinc-100">
              {img.imageUrl ? (
                <img
                  src={img.imageUrl}
                  alt={img.title || `Feedback image ${index + 1}`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-400">
                  <ImageIcon size={28} />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    No image yet
                  </span>
                </div>
              )}
              <div className="absolute top-2 left-2 rounded-md bg-black/75 text-white text-[10px] font-black uppercase px-2 py-1">
                Image {index + 1}
              </div>
              {img.status !== 'Active' && (
                <div className="absolute top-2 right-2 rounded-md bg-amber-500 text-white text-[10px] font-black uppercase px-2 py-1">
                  Hidden
                </div>
              )}
            </div>

            <div className="p-3 space-y-2.5 flex-1 flex flex-col">
              <label className="block">
                <span className="sr-only">Upload image {index + 1}</span>
                <span
                  className={`flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-[11px] font-black uppercase tracking-wider cursor-pointer ${
                    uploadingId === img.id
                      ? 'bg-zinc-300 text-zinc-600'
                      : 'bg-zinc-950 text-white hover:bg-black'
                  }`}
                >
                  <Upload size={14} />
                  {uploadingId === img.id
                    ? 'Uploading…'
                    : img.imageUrl
                      ? 'Replace image'
                      : 'Upload image'}
                  <input
                    type="file"
                    accept={IMAGE_FILE_ACCEPT}
                    className="sr-only"
                    disabled={uploadingId === img.id || saving}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void uploadFor(img.id, file);
                    }}
                  />
                </span>
              </label>

              <input
                value={img.title || ''}
                onChange={(e) => updateImage(img.id, { title: e.target.value })}
                placeholder="Alt / title (optional)"
                className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs font-semibold text-zinc-950 focus:outline-none focus:border-zinc-950"
              />

              <div className="flex flex-wrap gap-1.5 mt-auto">
                <button
                  type="button"
                  onClick={() =>
                    updateImage(img.id, {
                      status: img.status === 'Active' ? 'Inactive' : 'Active',
                    })
                  }
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider cursor-pointer ${
                    img.status === 'Active'
                      ? 'bg-zinc-950 text-white'
                      : 'bg-white border border-zinc-200 text-zinc-700'
                  }`}
                >
                  {img.status === 'Active' ? <Eye size={12} /> : <EyeOff size={12} />}
                  {img.status === 'Active' ? 'Active' : 'Inactive'}
                </button>
                <button
                  type="button"
                  onClick={() => moveImage(index, -1)}
                  disabled={index === 0}
                  className="p-1.5 rounded-lg border border-zinc-200 text-zinc-800 disabled:opacity-40 cursor-pointer hover:bg-white"
                  aria-label="Move earlier"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => moveImage(index, 1)}
                  disabled={index === draft.images.length - 1}
                  className="p-1.5 rounded-lg border border-zinc-200 text-zinc-800 disabled:opacity-40 cursor-pointer hover:bg-white"
                  aria-label="Move later"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => void removeImage(img.id)}
                  className="p-1.5 rounded-lg border border-rose-100 text-rose-600 cursor-pointer hover:bg-rose-50 ml-auto"
                  aria-label="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
