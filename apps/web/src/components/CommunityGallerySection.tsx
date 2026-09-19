'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
 * Homepage community strip — GPU translate3d infinite marquee.
 * Two identical halves; wrap at measured set width so the loop never jumps.
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
  const setWidthRef = useRef(0);
  const draggingRef = useRef(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const dragStartOffset = useRef(0);
  const movedRef = useRef(false);
  const axisLock = useRef<'x' | 'y' | null>(null);
  const pageCountRef = useRef(1);
  const resumeTimer = useRef<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [activePage, setActivePage] = useState(0);

  // Two identical halves — enough for a seamless -setWidth wrap
  const loopImages = useMemo(() => {
    if (images.length === 0) return [];
    return [...images, ...images];
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

  const measureSetWidth = useCallback(() => {
    const el = trackRef.current;
    if (!el || images.length === 0) return 0;
    const kids = el.children;
    // Distance from first card of half A → first card of half B (includes flex gap)
    if (kids.length >= images.length * 2) {
      const a = kids[0] as HTMLElement;
      const b = kids[images.length] as HTMLElement;
      const w = b.offsetLeft - a.offsetLeft;
      if (w > 0) return w;
    }
    return el.scrollWidth / 2;
  }, [images.length]);

  const applyOffset = useCallback(
    (next: number, updateDots = true) => {
      const el = trackRef.current;
      if (!el) return;

      let setWidth = setWidthRef.current;
      if (setWidth <= 0) {
        setWidth = measureSetWidth();
        setWidthRef.current = setWidth;
      }

      let offset = next;
      if (setWidth > 0) {
        // Seamless wrap — stay in [0, setWidth)
        offset = ((offset % setWidth) + setWidth) % setWidth;

        if (updateDots) {
          const pages = pageCountRef.current;
          const page = Math.floor((offset / setWidth) * pages) % pages;
          setActivePage((prev) => (prev === page ? prev : page));
        }
      }

      offsetRef.current = offset;
      el.style.transform = `translate3d(${-offset}px, 0, 0)`;
    },
    [measureSetWidth],
  );

  // Remeasure when images load / viewport changes
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const refresh = () => {
      setWidthRef.current = measureSetWidth();
      applyOffset(offsetRef.current, false);
    };

    refresh();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refresh) : null;
    ro?.observe(el);

    const imgs = el.querySelectorAll('img');
    imgs.forEach((img) => {
      if (!img.complete) img.addEventListener('load', refresh, { once: true });
    });

    return () => ro?.disconnect();
  }, [applyOffset, images.length, measureSetWidth]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || images.length < 2 || reduceMotion || paused) return;

    let raf = 0;
    let last = performance.now();
    // Faster continuous drift — still readable (~1.5–2s per card)
    const speed =
      typeof window !== 'undefined' && window.innerWidth < 640
        ? 78
        : typeof window !== 'undefined' && window.innerWidth < 1024
          ? 90
          : 105;

    const tick = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      if (!draggingRef.current) {
        applyOffset(offsetRef.current + (speed * dt) / 1000);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [applyOffset, images.length, paused, reduceMotion]);

  const clearResumeTimer = () => {
    if (resumeTimer.current != null) {
      window.clearTimeout(resumeTimer.current);
      resumeTimer.current = null;
    }
  };

  const scheduleResume = (ms: number) => {
    clearResumeTimer();
    resumeTimer.current = window.setTimeout(() => {
      resumeTimer.current = null;
      setPaused(false);
    }, ms);
  };

  useEffect(() => () => clearResumeTimer(), []);

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    movedRef.current = false;
    axisLock.current = null;
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    dragStartOffset.current = offsetRef.current;
    clearResumeTimer();
    setPaused(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragStartX.current;
    const dy = e.clientY - dragStartY.current;

    if (!axisLock.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      axisLock.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }

    // Vertical intent → let the page scroll; cancel drag
    if (axisLock.current === 'y') {
      draggingRef.current = false;
      scheduleResume(200);
      return;
    }

    if (axisLock.current === 'x') {
      e.preventDefault();
      if (Math.abs(dx) > 8) movedRef.current = true;
      applyOffset(dragStartOffset.current - dx);
    }
  };

  const endDrag = () => {
    draggingRef.current = false;
    axisLock.current = null;
    scheduleResume(700);
  };

  const goToPage = (page: number) => {
    const setWidth = setWidthRef.current || measureSetWidth();
    if (setWidth <= 0) return;
    setWidthRef.current = setWidth;
    clearResumeTimer();
    setPaused(true);
    applyOffset((page / pageCount) * setWidth);
    scheduleResume(1200);
  };

  const onAnchorClick = (e: React.MouseEvent) => {
    if (movedRef.current) {
      e.preventDefault();
      movedRef.current = false;
    }
  };

  if (gallery.enabled === false || images.length === 0) return null;

  return (
    <section className="community-gallery-section w-full max-w-[100vw] min-w-0 overflow-x-hidden bg-white text-[#0A0A0A]">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Join the VANSKAP Facebook Community"
        onClick={onAnchorClick}
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

          <div
            className="relative overflow-hidden w-full min-w-0 select-none"
            style={{ touchAction: 'pan-y', WebkitUserSelect: 'none' }}
            onMouseEnter={() => {
              if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
                clearResumeTimer();
                setPaused(true);
              }
            }}
            onMouseLeave={() => setPaused(false)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {/* Reserve height to avoid layout shift while images load */}
            <div
              className="min-h-[210px] sm:min-h-[290px] md:min-h-[350px] flex items-end"
              aria-hidden={false}
            >
              <div
                ref={trackRef}
                className="flex items-end gap-2 sm:gap-3.5 will-change-transform [backface-visibility:hidden]"
                style={{ transform: 'translate3d(0,0,0)' }}
              >
                {loopImages.map((img, index) => {
                  const size = communityImageDisplaySize(img, index % images.length);
                  // Mobile: [large][large] · Tablet: three larges · Desktop: sm/lg/lg/lg/sm rhythm
                  const tall =
                    size === 'lg'
                      ? 'h-[200px] w-[128px] sm:h-[280px] sm:w-[180px] md:h-[340px] md:w-[220px]'
                      : 'h-[170px] w-[110px] sm:h-[200px] sm:w-[140px] md:h-[240px] md:w-[160px]';
                  return (
                    <div
                      key={`${img.id}-${index}`}
                      className={`relative shrink-0 overflow-hidden bg-[#F4F4F3] rounded-sm ${tall}`}
                    >
                      <img
                        src={img.imageUrl}
                        alt={img.title || 'Vanskap community member'}
                        className="absolute inset-0 h-full w-full object-cover pointer-events-none"
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
        </div>
      </a>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-6 sm:pt-10">
        <div
          className="flex justify-center items-center gap-2.5 sm:gap-2"
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
              className={`min-h-8 min-w-8 sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center cursor-pointer border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A]`}
            >
              <span
                className={`block h-1.5 rounded-full transition-all ${
                  i === activePage ? 'w-5 bg-[#0A0A0A]' : 'w-1.5 bg-[#C8C8C8]'
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
