'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

/**
 * Homepage community strip — CSS transform marquee + semantic Facebook link.
 * Root cause previously: DynamicPageRenderer blacklisted `community-gallery` and never rendered it.
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

  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const draggingRef = useRef(false);
  const dragStartX = useRef(0);
  const dragStartOffset = useRef(0);
  const movedRef = useRef(false);
  const pageCountRef = useRef(1);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [activePage, setActivePage] = useState(0);

  const loopImages = useMemo(() => {
    if (images.length === 0) return [];
    // Triple for seamless CSS transform loop on all viewport sizes
    return [...images, ...images, ...images];
  }, [images]);

  const pageCount = Math.min(7, Math.max(1, images.length));
  pageCountRef.current = pageCount;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  const applyOffset = (next: number) => {
    const el = trackRef.current;
    if (!el) return;
    const setWidth = el.scrollWidth / 3;
    const pages = pageCountRef.current;
    let offset = next;
    if (setWidth > 0) {
      while (offset < 0) offset += setWidth;
      while (offset >= setWidth) offset -= setWidth;
      const page = Math.floor((offset / setWidth) * pages) % pages;
      setActivePage((prev) => (prev === page ? prev : page));
    }
    offsetRef.current = offset;
    el.style.transform = `translate3d(${-offset}px, 0, 0)`;
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el || images.length < 2 || reduceMotion || paused) return;

    let raf = 0;
    let last = performance.now();
    const speed = 42; // px/sec

    const tick = (now: number) => {
      const dt = Math.min(40, now - last);
      last = now;
      if (!draggingRef.current) {
        applyOffset(offsetRef.current + (speed * dt) / 1000);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [images.length, paused, reduceMotion]);

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    movedRef.current = false;
    dragStartX.current = e.clientX;
    dragStartOffset.current = offsetRef.current;
    setPaused(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragStartX.current;
    if (Math.abs(dx) > 8) movedRef.current = true;
    applyOffset(dragStartOffset.current - dx);
  };

  const endDrag = () => {
    draggingRef.current = false;
    window.setTimeout(() => setPaused(false), 1200);
  };

  const goToPage = (page: number) => {
    const el = trackRef.current;
    if (!el) return;
    const setWidth = el.scrollWidth / 3;
    if (setWidth <= 0) return;
    setPaused(true);
    applyOffset((page / pageCount) * setWidth);
    window.setTimeout(() => setPaused(false), 1800);
  };

  const onAnchorClick = (e: React.MouseEvent) => {
    // Horizontal drag should not navigate
    if (movedRef.current) {
      e.preventDefault();
      movedRef.current = false;
    }
  };

  if (gallery.enabled === false || images.length === 0) return null;

  return (
    <section className="community-gallery-section w-full bg-white text-[#0A0A0A]">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Join the VANSKAP Facebook Community"
        onClick={onAnchorClick}
        className="block w-full text-[#0A0A0A] no-underline outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A]/25 focus-visible:ring-offset-2 cursor-pointer"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-2 space-y-8 sm:space-y-10">
          <div className="text-center space-y-2 sm:space-y-3">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight text-[#0A0A0A]">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-sm sm:text-base text-[#555555] font-medium tracking-wide">
                {subtitle}
              </p>
            ) : null}
          </div>

          <div
            className="relative overflow-hidden touch-pan-y"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div
              ref={trackRef}
              className="flex items-end gap-2.5 sm:gap-3.5 will-change-transform"
              style={{ transform: 'translate3d(0,0,0)' }}
            >
              {loopImages.map((img, index) => {
                const size = communityImageDisplaySize(img, index % images.length);
                const tall =
                  size === 'lg'
                    ? 'h-[200px] w-[130px] sm:h-[280px] sm:w-[180px] md:h-[340px] md:w-[220px]'
                    : 'h-[150px] w-[100px] sm:h-[200px] sm:w-[140px] md:h-[240px] md:w-[160px]';
                return (
                  <div
                    key={`${img.id}-${index}`}
                    className={`relative shrink-0 overflow-hidden bg-[#F4F4F3] ${tall}`}
                  >
                    <img
                      src={img.imageUrl}
                      alt={img.title || 'Vanskap community member'}
                      className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                      loading={index < 8 ? 'eager' : 'lazy'}
                      decoding="async"
                      draggable={false}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </a>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-2 pt-8 sm:pt-10">
        <div
          className="flex justify-center items-center gap-2"
          role="tablist"
          aria-label="Community gallery pages"
        >
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={`dot-${i}`}
              type="button"
              role="tab"
              aria-selected={i === activePage}
              aria-label={`Gallery page ${i + 1}`}
              onClick={() => goToPage(i)}
              className={`h-1.5 rounded-full transition-all cursor-pointer border-0 p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A] ${
                i === activePage ? 'w-5 bg-[#0A0A0A]' : 'w-1.5 bg-[#C8C8C8]'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
