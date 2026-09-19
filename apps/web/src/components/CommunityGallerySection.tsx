'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { CommunityGalleryConfig } from '../types';
import {
  communityGallerySubtitleLine,
  communityImageDisplaySize,
  getActiveCommunityImages,
  normalizeCommunityGallery,
  VANSKAP_COMMUNITY_FACEBOOK_URL,
} from '../lib/communityGallery';

interface CommunityGallerySectionProps {
  config?: CommunityGalleryConfig | null;
  headingFallback?: string;
  subtitleFallback?: string;
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
 * Homepage community strip — CSS infinite marquee (same motion as club logos).
 */
export const CommunityGallerySection: React.FC<CommunityGallerySectionProps> = ({
  config,
  headingFallback,
  subtitleFallback,
}) => {
  const gallery = useMemo(() => normalizeCommunityGallery(config), [config]);
  const images = useMemo(() => getActiveCommunityImages(gallery), [gallery]);
  const title = (gallery.title || headingFallback || '').trim() || 'JOIN THE VANSKAP COMMUNITY';
  const subtitle =
    communityGallerySubtitleLine(gallery) || (subtitleFallback || '').trim();
  const href = (gallery.facebookUrl || VANSKAP_COMMUNITY_FACEBOOK_URL).trim();

  const halfImages = useMemo(() => buildMarqueeHalf(images), [images]);
  const loopImages = useMemo(
    () => (halfImages.length === 0 ? [] : [...halfImages, ...halfImages]),
    [halfImages],
  );

  // Club-logo pace: slow, steady, never rushed (photos are wider → longer duration)
  const durationSec = Math.max(48, Math.round(halfImages.length * 5.2));
  const [animReady, setAnimReady] = useState(false);

  useEffect(() => {
    setAnimReady(false);
    if (images.length === 0) return;
    const t = window.setTimeout(() => setAnimReady(true), ANIM_START_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [images.length, durationSec]);

  if (gallery.enabled === false || images.length === 0) return null;

  return (
    <section className="community-gallery-section w-full max-w-[100vw] min-w-0 overflow-x-hidden bg-white text-[#0A0A0A]">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Join the VANSKAP Facebook Community"
        className="block w-full min-w-0 text-[#0A0A0A] no-underline outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A]/25 focus-visible:ring-offset-2 cursor-pointer"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-1 sm:pt-2 space-y-6 sm:space-y-10">
          <div className="text-center space-y-1.5 sm:space-y-3 px-1">
            <h2 className="text-[1.05rem] leading-tight sm:text-2xl md:text-3xl font-black uppercase tracking-tight text-[#0A0A0A]">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-xs sm:text-base text-[#555555] font-medium tracking-wide">
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
                const size = communityImageDisplaySize(img, index % images.length);
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
                      alt={img.title || 'Vanskap community member'}
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
      </a>
    </section>
  );
};
