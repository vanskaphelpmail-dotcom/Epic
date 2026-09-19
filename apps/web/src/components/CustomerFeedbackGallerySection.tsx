'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { CustomerFeedbackGalleryConfig } from '../lib/customerFeedbackGallery';
import {
  customerFeedbackSubtitleLine,
  customerFeedbackImageDisplaySize,
  getActiveCustomerFeedbackImages,
  normalizeCustomerFeedbackGallery,
} from '../lib/customerFeedbackGallery';

interface CustomerFeedbackGallerySectionProps {
  config?: CustomerFeedbackGalleryConfig | null;
  headingFallback?: string;
  subtitleFallback?: string;
  /** Tighter vertical rhythm (About / Journey). */
  compact?: boolean;
}

const ANIM_START_DELAY_MS = 700;

/** Pad one marquee half wide enough for a seamless -50% CSS loop */
function buildMarqueeHalf<T>(items: T[]): T[] {
  if (items.length === 0) return [];
  const minCards = Math.max(10, items.length * 2);
  const half: T[] = [];
  while (half.length < minCards) half.push(...items);
  return half;
}

/**
 * Customers Feedback / Journey strip — CSS infinite marquee (same motion as club logos).
 */
export const CustomerFeedbackGallerySection: React.FC<CustomerFeedbackGallerySectionProps> = ({
  config,
  headingFallback,
  subtitleFallback,
  compact = false,
}) => {
  const gallery = useMemo(() => normalizeCustomerFeedbackGallery(config), [config]);
  const images = useMemo(() => getActiveCustomerFeedbackImages(gallery), [gallery]);
  const title = (gallery.title || headingFallback || '').trim() || 'CUSTOMERS FEEDBACK';
  const subtitle =
    customerFeedbackSubtitleLine(gallery) || (subtitleFallback || '').trim();
  const href = (gallery.facebookUrl || '').trim();
  const hasLink = /^https?:\/\//i.test(href);

  const halfImages = useMemo(() => buildMarqueeHalf(images), [images]);
  const loopImages = useMemo(
    () => (halfImages.length === 0 ? [] : [...halfImages, ...halfImages]),
    [halfImages],
  );

  // Same perceived pace as club-logo ticker
  const durationSec = Math.max(36, Math.round(halfImages.length * 2.6));
  const [animReady, setAnimReady] = useState(false);

  useEffect(() => {
    setAnimReady(false);
    if (images.length === 0) return;
    const t = window.setTimeout(() => setAnimReady(true), ANIM_START_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [images.length, durationSec]);

  if (gallery.enabled === false || images.length === 0) return null;

  const shellClassName =
    'block w-full min-w-0 text-[#0A0A0A] no-underline outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A]/25 focus-visible:ring-offset-2';

  const galleryInner = (
    <div
      className={`max-w-7xl mx-auto px-4 sm:px-6 ${
        compact
          ? 'pt-0 pb-2 sm:pb-3 space-y-4 sm:space-y-5'
          : 'pt-1 sm:pt-2 pb-6 sm:pb-8 space-y-6 sm:space-y-10'
      }`}
    >
      <div className={`text-center px-1 ${compact ? 'space-y-1 sm:space-y-2' : 'space-y-1.5 sm:space-y-3'}`}>
        <h2
          className={`font-black uppercase tracking-tight text-[#0A0A0A] leading-tight ${
            compact
              ? 'text-base sm:text-xl md:text-2xl'
              : 'text-[1.05rem] sm:text-2xl md:text-3xl'
          }`}
        >
          {title}
        </h2>
        {subtitle ? (
          <p
            className={`text-[#555555] font-medium tracking-wide ${
              compact ? 'text-[11px] sm:text-sm' : 'text-xs sm:text-base'
            }`}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="gallery-photo-marquee relative w-full overflow-hidden py-1">
        <div
          className={`gallery-photo-marquee-track flex w-max items-center gap-3 sm:gap-4 md:gap-5 ${
            animReady ? 'is-running' : 'is-waiting'
          }`}
          style={{ animationDuration: `${durationSec}s` }}
        >
          {loopImages.map((img, index) => {
            const size = customerFeedbackImageDisplaySize(img, index % images.length);
            const widthCls =
              size === 'lg'
                ? 'w-[128px] sm:w-[180px] md:w-[220px]'
                : 'w-[110px] sm:w-[140px] md:w-[160px]';
            return (
              <div
                key={`${img.id}-${index}`}
                className={`relative shrink-0 overflow-hidden bg-transparent border-0 shadow-none ${widthCls}`}
              >
                <img
                  src={img.imageUrl}
                  alt={img.title || 'Customer feedback'}
                  className="pointer-events-none block w-full !h-auto max-h-none object-cover align-middle"
                  loading={index < 6 ? 'eager' : 'lazy'}
                  decoding="async"
                  draggable={false}
                  referrerPolicy="no-referrer"
                  sizes="(max-width: 640px) 130px, (max-width: 768px) 180px, 220px"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <section className="customer-feedback-gallery-section w-full max-w-[100vw] min-w-0 overflow-x-hidden bg-white text-[#0A0A0A]">
      {hasLink ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Customers feedback gallery"
          className={`${shellClassName} cursor-pointer`}
        >
          {galleryInner}
        </a>
      ) : (
        <div className={shellClassName}>{galleryInner}</div>
      )}
    </section>
  );
};
