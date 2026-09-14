import { isRenderableImageSrc } from './productImage';
import type { Product } from '../types';

/** Slow enough that shoppers can follow the item into the cart. */
const FLY_MS = 2200;
const FLY_MS_REDUCED = 1100;
const MAX_CONCURRENT = 8;
const CART_BOUNCE_MS = 700;
const LAYER_ID = 'fly-to-cart-root';

let activeFlyers = 0;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isElementVisible(el: HTMLElement | null | undefined): el is HTMLElement {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
  }
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
}

function getFlyLayer(): HTMLElement {
  let layer = document.getElementById(LAYER_ID);
  if (layer) return layer;
  layer = document.createElement('div');
  layer.id = LAYER_ID;
  Object.assign(layer.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '2147483000',
    overflow: 'visible',
  } as CSSStyleDeclaration);
  // Attach to <html> so body overflow-x-hidden cannot clip the flyer
  document.documentElement.appendChild(layer);
  return layer;
}

/**
 * Prefer the cart users actually see:
 * - phone / tablet (< lg): bottom nav cart, then mobile header bag
 * - desktop: header cart
 */
export function resolveCartTarget(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const header = document.querySelector<HTMLElement>('[data-cart-target="header"]');
  const headerMobile = document.querySelector<HTMLElement>('[data-cart-target="header-mobile"]');
  const mobile = document.querySelector<HTMLElement>('[data-cart-target="mobile"]');
  const fallback = document.getElementById('shopping-bag-btn');
  const isCompact = window.matchMedia('(max-width: 1023px)').matches;
  const ordered = isCompact
    ? [mobile, headerMobile, header, fallback]
    : [header, headerMobile, mobile, fallback];

  for (const el of ordered) {
    if (isElementVisible(el)) return el;
  }
  return ordered.find((el): el is HTMLElement => !!el) || null;
}

function pulseCartTarget(cart: HTMLElement) {
  try {
    cart.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.28)' },
        { transform: 'scale(0.92)' },
        { transform: 'scale(1.12)' },
        { transform: 'scale(1)' },
      ],
      { duration: CART_BOUNCE_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  } catch {
    /* ignore */
  }

  const badge = cart.querySelector<HTMLElement>('[data-cart-count]');
  if (badge) {
    try {
      badge.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.45)' },
          { transform: 'scale(1)' },
        ],
        { duration: 480, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      );
    } catch {
      /* ignore */
    }
  }
}

function pickProductImageSrc(product: Product | null | undefined, sourceEl?: HTMLElement | null): string | null {
  if (product) {
    const candidates = [
      product.uploadedImage,
      ...(product.gallery || []),
      ...(product.images || []),
      product.image,
    ];
    for (const c of candidates) {
      if (isRenderableImageSrc(c)) return String(c).trim();
    }
  }
  const img = sourceEl?.querySelector?.('img');
  const fromDom = img?.currentSrc || img?.src || '';
  if (isRenderableImageSrc(fromDom)) return fromDom.trim();
  return null;
}

function resolveSourceEl(product?: Product | null, preferred?: HTMLElement | null): HTMLElement | null {
  if (preferred) {
    const r = preferred.getBoundingClientRect();
    if (r.width >= 2 && r.height >= 2) return preferred;
  }
  if (typeof document === 'undefined') return preferred || null;
  if (product?.id) {
    try {
      const card = document.querySelector<HTMLElement>(
        `#product-card-${CSS.escape(String(product.id))} [data-product-fly-image]`,
      );
      if (card) {
        const r = card.getBoundingClientRect();
        if (r.width >= 2 && r.height >= 2) return card;
      }
    } catch {
      /* invalid id */
    }
  }
  const any = document.querySelector<HTMLElement>('[data-product-fly-image]');
  if (any) {
    const r = any.getBoundingClientRect();
    if (r.width >= 2 && r.height >= 2) return any;
  }
  return preferred || null;
}

/**
 * Clone a product image and fly it to the cart icon (header or mobile nav).
 * Always shows motion — falls back to a jersey chip if no photo URL.
 */
export function flyImageToCart(
  sourceEl: HTMLElement | null | undefined,
  imageSrc: string | null | undefined,
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const cart = resolveCartTarget();
  if (!cart) return;

  let src = String(imageSrc || '').trim();
  if (!isRenderableImageSrc(src) && sourceEl) {
    const img = sourceEl.querySelector('img');
    const fromDom = img?.currentSrc || img?.src || '';
    if (isRenderableImageSrc(fromDom)) src = fromDom.trim();
  }

  const reduced = prefersReducedMotion();
  const end = cart.getBoundingClientRect();
  if (end.width < 2 || end.height < 2) {
    pulseCartTarget(cart);
    return;
  }

  if (activeFlyers >= MAX_CONCURRENT) {
    pulseCartTarget(cart);
    return;
  }

  let start: { left: number; top: number; width: number; height: number };
  if (sourceEl) {
    const r = sourceEl.getBoundingClientRect();
    if (r.width >= 2 && r.height >= 2) {
      start = { left: r.left, top: r.top, width: r.width, height: r.height };
    } else {
      start = {
        left: Math.max(24, window.innerWidth / 2 - 40),
        top: Math.max(80, window.innerHeight / 2 - 40),
        width: 80,
        height: 80,
      };
    }
  } else {
    start = {
      left: Math.max(24, window.innerWidth / 2 - 40),
      top: Math.max(80, window.innerHeight / 2 - 40),
      width: 80,
      height: 80,
    };
  }

  activeFlyers += 1;

  const duration = reduced ? FLY_MS_REDUCED : FLY_MS;
  const startW = start.width;
  const startH = start.height;
  const endSize = Math.max(28, Math.min(44, Math.min(end.width, end.height) * 0.95));
  const endLeft = end.left + end.width / 2 - endSize / 2;
  const endTop = end.top + end.height / 2 - endSize / 2;

  const midX = start.left + (endLeft - start.left) * 0.42;
  const lift = Math.min(120, Math.max(48, Math.abs(endTop - start.top) * 0.28));
  const midY = Math.min(start.top, endTop) - lift;

  const useImg = isRenderableImageSrc(src);
  const clone = document.createElement(useImg ? 'img' : 'div');
  if (clone instanceof HTMLImageElement) {
    clone.src = src;
    clone.alt = '';
    clone.referrerPolicy = 'no-referrer';
    clone.draggable = false;
  } else {
    clone.textContent = '⚽';
    Object.assign(clone.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '28px',
      background: '#0A0A0A',
      color: '#fff',
    });
  }
  clone.setAttribute('aria-hidden', 'true');
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${start.left}px`,
    top: `${start.top}px`,
    width: `${startW}px`,
    height: `${startH}px`,
    objectFit: 'contain',
    borderRadius: '14px',
    zIndex: '2147483001',
    pointerEvents: 'none',
    margin: '0',
    padding: '0',
    boxShadow: '0 18px 44px rgba(10,10,10,0.28)',
    background: useImg ? 'rgba(255,255,255,0.92)' : '#0A0A0A',
    border: '1px solid rgba(229,229,229,0.95)',
    transformOrigin: 'top left',
    transform: 'translate3d(0,0,0) scale(1)',
    opacity: '1',
    willChange: 'transform, opacity',
    backfaceVisibility: 'hidden',
  } as CSSStyleDeclaration);

  getFlyLayer().appendChild(clone);

  const scaleMid = 0.72;
  const scaleEnd = endSize / Math.max(startW, 1);
  const dxMid = midX - start.left;
  const dyMid = midY - start.top;
  const dxEnd = endLeft - start.left;
  const dyEnd = endTop - start.top;

  let animation: Animation;
  try {
    animation = clone.animate(
      [
        { transform: 'translate3d(0px, 0px, 0) scale(1)', opacity: 1, offset: 0 },
        { transform: 'translate3d(0px, -10px, 0) scale(1.04)', opacity: 1, offset: 0.12 },
        {
          transform: `translate3d(${dxMid * 0.28}px, ${dyMid * 0.32}px, 0) scale(0.9)`,
          opacity: 1,
          offset: 0.32,
        },
        {
          transform: `translate3d(${dxMid}px, ${dyMid}px, 0) scale(${scaleMid})`,
          opacity: 1,
          offset: 0.55,
        },
        {
          transform: `translate3d(${dxMid + (dxEnd - dxMid) * 0.55}px, ${dyMid + (dyEnd - dyMid) * 0.55}px, 0) scale(${(scaleMid + scaleEnd) / 2})`,
          opacity: 0.95,
          offset: 0.82,
        },
        {
          transform: `translate3d(${dxEnd}px, ${dyEnd}px, 0) scale(${scaleEnd})`,
          opacity: 0.35,
          offset: 1,
        },
      ],
      {
        duration,
        easing: 'cubic-bezier(0.33, 0.05, 0.2, 1)',
        fill: 'forwards',
      },
    );
  } catch {
    clone.remove();
    activeFlyers = Math.max(0, activeFlyers - 1);
    pulseCartTarget(cart);
    return;
  }

  const cleanup = () => {
    clone.remove();
    activeFlyers = Math.max(0, activeFlyers - 1);
  };

  animation.addEventListener('finish', () => {
    pulseCartTarget(cart);
    cleanup();
  });
  animation.addEventListener('cancel', cleanup);

  window.setTimeout(() => {
    if (clone.isConnected) cleanup();
  }, duration + 600);
}

/** Storefront helper — resolve card image + fly to bag from any add-to-cart path. */
export function flyProductToCart(
  product: Product | null | undefined,
  preferredSource?: HTMLElement | null,
): void {
  if (!product) return;
  // Next frame so layout/refs are settled after click
  window.requestAnimationFrame(() => {
    const sourceEl = resolveSourceEl(product, preferredSource);
    const src = pickProductImageSrc(product, sourceEl);
    flyImageToCart(sourceEl, src);
  });
}
