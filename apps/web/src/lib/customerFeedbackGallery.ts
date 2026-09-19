import type { CommunityGalleryConfig, CommunityGalleryImage } from '../types';

/** Reuse community image shape — feedback gallery is the same carousel model. */
export type CustomerFeedbackImage = CommunityGalleryImage;
export type CustomerFeedbackGalleryConfig = CommunityGalleryConfig;

export const DEFAULT_CUSTOMER_FEEDBACK_GALLERY: CustomerFeedbackGalleryConfig = {
  title: 'CUSTOMERS FEEDBACK',
  membersLabel: '',
  subtitle: 'Real photos from verified buyers',
  facebookUrl: '',
  enabled: true,
  images: [],
};

function moneyStatus(raw: unknown): 'Active' | 'Inactive' {
  return String(raw || '').toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
}

export function normalizeCustomerFeedbackImage(
  entry: unknown,
  index: number,
): CustomerFeedbackImage | null {
  if (!entry || typeof entry !== 'object') return null;
  const row = entry as Record<string, unknown>;
  const imageUrl = String(row.imageUrl || row.image || row.src || '').trim();
  if (!imageUrl) return null;
  const sizeRaw = String(row.size || '').toLowerCase();
  const activeFlag =
    row.isActive === false || row.isActive === 'false' || row.isActive === 0
      ? 'Inactive'
      : row.isActive === true || row.isActive === 'true' || row.isActive === 1
        ? 'Active'
        : moneyStatus(row.status);
  return {
    id: String(row.id || `feedback-${index + 1}`).trim() || `feedback-${index + 1}`,
    imageUrl,
    title: String(row.title || row.name || row.altText || '').trim() || undefined,
    status: activeFlag,
    sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index,
    size:
      sizeRaw === 'sm' || sizeRaw === 'small'
        ? 'sm'
        : sizeRaw === 'lg' || sizeRaw === 'large'
          ? 'lg'
          : undefined,
  };
}

export function normalizeCustomerFeedbackGallery(
  raw: unknown | null | undefined,
): CustomerFeedbackGalleryConfig {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_CUSTOMER_FEEDBACK_GALLERY,
      images: [],
    };
  }

  const row = raw as Record<string, unknown>;
  const images = Array.isArray(row.images)
    ? row.images
        .map((item, i) => normalizeCustomerFeedbackImage(item, i))
        .filter(Boolean)
        .sort((a, b) => (a!.sortOrder ?? 0) - (b!.sortOrder ?? 0))
        .map((img, i) => ({ ...img!, sortOrder: i }))
    : [];

  return {
    title:
      String(row.title || '').trim() || DEFAULT_CUSTOMER_FEEDBACK_GALLERY.title,
    membersLabel: String(row.membersLabel || row.members || '').trim(),
    subtitle:
      String(row.subtitle || '').trim() || DEFAULT_CUSTOMER_FEEDBACK_GALLERY.subtitle,
    facebookUrl: String(row.facebookUrl || row.linkUrl || '').trim(),
    enabled:
      row.enabled === false || row.isEnabled === false || row.isEnabled === 'false'
        ? false
        : true,
    images: images as CustomerFeedbackImage[],
  };
}

export function getActiveCustomerFeedbackImages(
  config: CustomerFeedbackGalleryConfig | null | undefined,
): CustomerFeedbackImage[] {
  const normalized = normalizeCustomerFeedbackGallery(config);
  return normalized.images
    .filter((img) => img.status === 'Active' && !!img.imageUrl)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function customerFeedbackSubtitleLine(
  config: CustomerFeedbackGalleryConfig,
): string {
  const members = (config.membersLabel || '').trim();
  const subtitle = (config.subtitle || '').trim();
  if (members && subtitle) {
    if (subtitle.toLowerCase().startsWith(members.toLowerCase())) return subtitle;
    return `${members} ${subtitle}`.replace(/\s+/g, ' ').trim();
  }
  return members || subtitle || '';
}

export function customerFeedbackImageDisplaySize(
  image: CustomerFeedbackImage,
  index: number,
): 'sm' | 'lg' {
  if (image.size === 'sm' || image.size === 'lg') return image.size;
  const slot = index % 5;
  return slot === 0 || slot === 4 ? 'sm' : 'lg';
}
