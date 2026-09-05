import type { BannerType } from '../types';

export type BannerDevice = 'desktop' | 'tablet' | 'mobile';

export type BannerPixelSpec = {
  width: number;
  height: number;
  /** Tailwind-friendly aspect ratio string for preview boxes */
  aspectClass: string;
  label: string;
};

/** Exact upload sizes aligned to storefront display heights (Hero uses 320 / 480 / 550). */
const HERO_SPECS: Record<BannerDevice, BannerPixelSpec> = {
  desktop: { width: 1920, height: 550, aspectClass: 'aspect-[1920/550]', label: 'Web / Desktop' },
  tablet: { width: 1024, height: 480, aspectClass: 'aspect-[1024/480]', label: 'Tablet' },
  mobile: { width: 768, height: 320, aspectClass: 'aspect-[768/320]', label: 'Mobile' },
};

const STRIP_SPECS: Record<BannerDevice, BannerPixelSpec> = {
  desktop: { width: 1600, height: 400, aspectClass: 'aspect-[1600/400]', label: 'Web / Desktop' },
  tablet: { width: 1024, height: 320, aspectClass: 'aspect-[1024/320]', label: 'Tablet' },
  mobile: { width: 768, height: 280, aspectClass: 'aspect-[768/280]', label: 'Mobile' },
};

const POPUP_SPECS: Record<BannerDevice, BannerPixelSpec> = {
  desktop: { width: 800, height: 600, aspectClass: 'aspect-[800/600]', label: 'Web / Desktop' },
  tablet: { width: 640, height: 480, aspectClass: 'aspect-[640/480]', label: 'Tablet' },
  mobile: { width: 400, height: 500, aspectClass: 'aspect-[400/500]', label: 'Mobile' },
};

const FOOTER_SPECS: Record<BannerDevice, BannerPixelSpec> = {
  desktop: { width: 1400, height: 280, aspectClass: 'aspect-[1400/280]', label: 'Web / Desktop' },
  tablet: { width: 1024, height: 240, aspectClass: 'aspect-[1024/240]', label: 'Tablet' },
  mobile: { width: 768, height: 220, aspectClass: 'aspect-[768/220]', label: 'Mobile' },
};

const MOBILE_ONLY_SPECS: Record<BannerDevice, BannerPixelSpec> = {
  desktop: { width: 768, height: 320, aspectClass: 'aspect-[768/320]', label: 'Web / Desktop' },
  tablet: { width: 768, height: 320, aspectClass: 'aspect-[768/320]', label: 'Tablet' },
  mobile: { width: 768, height: 320, aspectClass: 'aspect-[768/320]', label: 'Mobile' },
};

export function getBannerPixelSpecs(type?: BannerType | string): Record<BannerDevice, BannerPixelSpec> {
  switch (type) {
    case 'Popup Banner':
      return POPUP_SPECS;
    case 'Newsletter Banner':
    case 'Footer Banner':
      return FOOTER_SPECS;
    case 'Mobile Banner':
      return MOBILE_ONLY_SPECS;
    case 'Category Banner':
    case 'Collection Banner':
    case 'League Banner':
    case 'Offer Banner':
    case 'Blog Banner':
      return STRIP_SPECS;
    case 'Hero Slider':
    default:
      return HERO_SPECS;
  }
}

export function formatBannerPx(spec: BannerPixelSpec): string {
  return `${spec.width} × ${spec.height} px`;
}
