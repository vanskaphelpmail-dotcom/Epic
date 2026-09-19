import type { CommunityGalleryConfig, CommunityGalleryImage } from '../types';
import {
  getActiveCustomerFeedbackImages,
  normalizeCustomerFeedbackGallery,
  customerFeedbackSubtitleLine,
  customerFeedbackImageDisplaySize,
} from './customerFeedbackGallery';

/** Same carousel model as Customers Feedback — About page story gallery. */
export type JourneyGalleryImage = CommunityGalleryImage;
export type JourneyGalleryConfig = CommunityGalleryConfig;

export const DEFAULT_JOURNEY_GALLERY: JourneyGalleryConfig = {
  title: 'JOURNEY WE MAKE EPIC VANSKAP',
  membersLabel: '',
  subtitle: 'Five Friends. One Dream. One Vanskap.',
  facebookUrl: '',
  enabled: true,
  images: [],
};

export function normalizeJourneyGallery(
  raw: unknown | null | undefined,
): JourneyGalleryConfig {
  const normalized = normalizeCustomerFeedbackGallery(raw);
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_JOURNEY_GALLERY, images: [] };
  }
  const row = raw as Record<string, unknown>;
  return {
    ...normalized,
    title: String(row.title || '').trim() || DEFAULT_JOURNEY_GALLERY.title,
    subtitle:
      String(row.subtitle || '').trim() || DEFAULT_JOURNEY_GALLERY.subtitle,
    membersLabel: String(row.membersLabel || row.members || '').trim(),
  };
}

export function getActiveJourneyImages(
  config: JourneyGalleryConfig | null | undefined,
): JourneyGalleryImage[] {
  return getActiveCustomerFeedbackImages(normalizeJourneyGallery(config));
}

export const journeySubtitleLine = customerFeedbackSubtitleLine;
export const journeyImageDisplaySize = customerFeedbackImageDisplaySize;
