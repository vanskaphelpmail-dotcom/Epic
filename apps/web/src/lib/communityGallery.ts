import type { CommunityGalleryConfig, CommunityGalleryImage } from '../types';

export const VANSKAP_COMMUNITY_FACEBOOK_URL =
  'https://www.facebook.com/share/g/1DpkyuqPAh/?mibextid=wwXIfr';

/** Seed lifestyle shots shipped in /public/community — admin can replace anytime. */
const DEFAULT_IMAGE_SRCS = [
  '/community/community-1.png',
  '/community/community-2.png',
  '/community/community-3.png',
  '/community/community-4.png',
  '/community/community-5.png',
  '/community/community-6.png',
  '/community/community-7.png',
  '/community/community-8.png',
  '/community/community-9.png',
  '/community/community-10.png',
  '/community/community-11.png',
  '/community/community-12.png',
  '/community/community-13.png',
  '/community/community-14.png',
];

export const DEFAULT_COMMUNITY_GALLERY: CommunityGalleryConfig = {
  title: 'JOIN THE VANSKAP COMMUNITY',
  membersLabel: '+6,783',
  subtitle: 'Members Since 2024.',
  facebookUrl: VANSKAP_COMMUNITY_FACEBOOK_URL,
  enabled: true,
  images: DEFAULT_IMAGE_SRCS.map((imageUrl, index) => ({
    id: `community-default-${index + 1}`,
    imageUrl,
    title: `Community ${index + 1}`,
    status: 'Active' as const,
    sortOrder: index,
    size: index % 5 === 0 || index % 5 === 4 ? 'sm' : 'lg',
  })),
};

function moneyStatus(raw: unknown): 'Active' | 'Inactive' {
  return String(raw || '').toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
}

export function normalizeCommunityGalleryImage(
  entry: unknown,
  index: number,
): CommunityGalleryImage | null {
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
    id: String(row.id || `community-${index + 1}`).trim() || `community-${index + 1}`,
    imageUrl,
    title: String(row.title || row.name || row.altText || '').trim() || undefined,
    status: activeFlag,
    sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index,
    size: sizeRaw === 'sm' || sizeRaw === 'small' ? 'sm' : sizeRaw === 'lg' || sizeRaw === 'large' ? 'lg' : undefined,
  };
}

export function normalizeCommunityGallery(
  raw: unknown | null | undefined,
): CommunityGalleryConfig {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_COMMUNITY_GALLERY,
      images: DEFAULT_COMMUNITY_GALLERY.images.map((img) => ({ ...img })),
    };
  }

  const row = raw as Record<string, unknown>;
  const images = Array.isArray(row.images)
    ? row.images
        .map((item, i) => normalizeCommunityGalleryImage(item, i))
        .filter(Boolean)
        .sort((a, b) => (a!.sortOrder ?? 0) - (b!.sortOrder ?? 0))
        .map((img, i) => ({ ...img!, sortOrder: i }))
    : [];

  const title =
    String(row.title || '').trim() || DEFAULT_COMMUNITY_GALLERY.title;
  const membersLabel =
    String(row.membersLabel || row.members || row.memberCount || '').trim() ||
    DEFAULT_COMMUNITY_GALLERY.membersLabel;
  const subtitle =
    String(row.subtitle || row.memberSubtitle || '').trim() ||
    DEFAULT_COMMUNITY_GALLERY.subtitle;
  const facebookUrl =
    String(row.facebookUrl || row.communityUrl || row.linkUrl || '').trim() ||
    VANSKAP_COMMUNITY_FACEBOOK_URL;
  const enabled =
    row.enabled === false || row.isEnabled === false || row.isEnabled === 'false'
      ? false
      : true;

  return {
    title,
    membersLabel,
    subtitle,
    facebookUrl,
    enabled,
    images:
      images.length > 0
        ? (images as CommunityGalleryImage[])
        : DEFAULT_COMMUNITY_GALLERY.images.map((img) => ({ ...img })),
  };
}

export function getActiveCommunityImages(
  config: CommunityGalleryConfig | null | undefined,
): CommunityGalleryImage[] {
  const normalized = normalizeCommunityGallery(config);
  return normalized.images
    .filter((img) => img.status === 'Active' && !!img.imageUrl)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function communityGallerySubtitleLine(config: CommunityGalleryConfig): string {
  const members = (config.membersLabel || '').trim();
  const subtitle = (config.subtitle || '').trim();
  if (members && subtitle) {
    if (subtitle.toLowerCase().startsWith(members.toLowerCase())) return subtitle;
    return `${members} ${subtitle}`.replace(/\s+/g, ' ').trim();
  }
  return members || subtitle || '';
}

/** Visual size for the marquee tile — admin override or focal pattern. */
export function communityImageDisplaySize(
  image: CommunityGalleryImage,
  index: number,
): 'sm' | 'lg' {
  if (image.size === 'sm' || image.size === 'lg') return image.size;
  const slot = index % 5;
  return slot === 0 || slot === 4 ? 'sm' : 'lg';
}
