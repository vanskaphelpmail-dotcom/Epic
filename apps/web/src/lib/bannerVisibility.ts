import type { BannerConfig } from '../types';

/** Storefront: only Active banners should render. */
export function isBannerLive(banner: Pick<BannerConfig, 'status'> | { status?: string } | null | undefined): boolean {
  if (!banner) return false;
  const s = String(banner.status || '').trim().toLowerCase();
  return s === 'active';
}

export function isHeroBannerType(banner: Pick<BannerConfig, 'type' | 'id'> | { type?: string; id?: string }): boolean {
  const type = String(banner.type || '');
  const id = String(banner.id || '');
  return (
    type === 'Hero Slider' ||
    type.includes('Hero') ||
    id.startsWith('banner-hero') ||
    id === 'hero-slider'
  );
}
