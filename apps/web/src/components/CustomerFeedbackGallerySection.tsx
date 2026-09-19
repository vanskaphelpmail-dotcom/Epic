'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
}

/**
 * Customers Feedback strip — same marquee pattern as Community Gallery.
 */
export const CustomerFeedbackGallerySection: React.FC<CustomerFeedbackGallerySectionProps> = ({
  config,
  headingFallback,
  subtitleFallback,
}) => {
  const gallery = useMemo(() => normalizeCustomerFeedbackGallery(config), [config]);
  const images = useMemo(() => getActiveCustomerFeedbackImages(gallery), [gallery]);
  const title = (gallery.title || headingFallback || '').trim() || 'CUSTOMERS FEEDBACK';
  const subtitle =
    customerFeedbackSubtitleLine(gallery) || (subtitleFallback || '').trim();
  const href = (gallery.facebookUrl || '').trim();
  const hasLink = /^https?:\/\//i.test(href);

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

  // Pad then double — fills wide viewports so the seamless wrap never shows a gap
  const halfImages = useMemo(() => {
    if (images.length === 0) return [];
    const minCards = Math.max(10, images.length * 2);
    const half: typeof images = [];
    while (half.length < minCards) half.push(...images);
    return half;
  }, [images]);
  const loopImages = useMemo(
    () => (halfImages.length === 0 ? [] : [...halfImages, ...halfImages]),
    [halfImages],
  );

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
    if (!el || halfImages.length === 0) return 0;
    const kids = el.children;
    // Distance from first card of half A → first card of half B (includes flex gap)
    if (kids.length >= halfImages.length * 2) {
      const a = kids[0] as HTMLElement;
      const b = kids[halfImages.length] as HTMLElement;
      const w = b.offsetLeft - a.offsetLeft;
      if (w > 0) return w;
    }
    return el.scrollWidth / 2;
  }, [halfImages.length]);

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
  }, [applyOffset, halfImages.length, measureSetWidth]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || images.length < 1 || reduceMotion || paused) return;

    let raf = 0;
    let last = performance.now();
    // Fast continuous drift — club-flag style, never idle
    const speed =
      typeof window !== 'undefined' && window.innerWidth < 640
        ? 220
        : typeof window !== 'undefined' && window.innerWidth < 1024
          ? 260
          : 300;

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
    scheduleResume(350);
  };

  const goToPage = (page: number) => {
    const setWidth = setWidthRef.current || measureSetWidth();
    if (setWidth <= 0) return;
    setWidthRef.current = setWidth;
    clearResumeTimer();
    setPaused(true);
    applyOffset((page / pageCount) * setWidth);
    scheduleResume(500);
  };

  const onAnchorClick = (e: React.MouseEvent) => {
    if (movedRef.current) {
      e.preventDefault();
      movedRef.current = false;
    }
  };

  if (gallery.enabled === false || images.length === 0) return null;

  const shellClassName =
    'block w-full min-w-0 text-[#0A0A0A] no-underline outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A]/25 focus-visible:ring-offset-2';
  const galleryInner = (
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
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {/* Height follows tallest image — cards vertically centered */}
            <div className="flex items-center w-full min-w-0">
              <div
                ref={trackRef}
                className="flex items-center gap-1.5 sm:gap-2 will-change-transform [backface-visibility:hidden]"
                style={{ transform: 'translate3d(0,0,0)' }}
              >
                {loopImages.map((img, index) => {
                  const size = customerFeedbackImageDisplaySize(img, index % images.length);
                  // Width rhythm only — height follows the photo (no empty card area)
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
          onClick={onAnchorClick}
          className={`${shellClassName} cursor-pointer`}
        >
          {galleryInner}
        </a>
      ) : (
        <div className={shellClassName}>{galleryInner}</div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-6 sm:pt-10">
        <div
          className="flex justify-center items-center gap-2.5 sm:gap-2"
          role="tablist"
          aria-label="Customers feedback pages"
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
