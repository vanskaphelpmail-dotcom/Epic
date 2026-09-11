import { isRenderableImageSrc } from './productImage';

/** Slow enough that shoppers can follow the item into the cart. */
const FLY_MS = 2600;
const FLY_MS_REDUCED = 1400;
const MAX_CONCURRENT = 8;
const CART_BOUNCE_MS = 700;

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
  // Must be on-screen (or mostly) so the fly lands on a real target
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
}

/**
 * Prefer the cart users actually see:
 * - phone / tablet (< lg): bottom nav cart
 * - desktop: header cart
 * Falls back to any visible target so every viewport gets the animation.
 */
export function resolveCartTarget(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const header = document.querySelector<HTMLElement>('[data-cart-target="header"]');
  const mobile = document.querySelector<HTMLElement>('[data-cart-target="mobile"]');
  const fallback = document.getElementById('shopping-bag-btn');
  const isCompact = window.matchMedia('(max-width: 1023px)').matches;
  const ordered = isCompact
    ? [mobile, header, fallback]
    : [header, mobile, fallback];

  for (const el of ordered) {
    if (isElementVisible(el)) return el;
  }
  return ordered.find((el): el is HTMLElement => !!el) || null;
}

function pulseCartTarget(cart: HTMLElement) {
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

  const badge = cart.querySelector<HTMLElement>('[data-cart-count]');
  if (badge) {
    badge.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.45)' },
        { transform: 'scale(1)' },
      ],
      { duration: 480, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  }
}

/**
 * Clone a product image and fly it to the cart icon (header or mobile nav).
 * Uses GPU transforms for a smooth arc on web, tablet, and phone.
 * Does not affect cart state — call add-to-cart separately.
 */
export function flyImageToCart(
  sourceEl: HTMLElement | null | undefined,
  imageSrc: string | null | undefined,
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const cart = resolveCartTarget();
  if (!cart) return;

  const src = String(imageSrc || '').trim();
  const reduced = prefersReducedMotion();

  if (!isRenderableImageSrc(src) || !sourceEl) {
    pulseCartTarget(cart);
    return;
  }

  if (activeFlyers >= MAX_CONCURRENT) {
    pulseCartTarget(cart);
    return;
  }

  const start = sourceEl.getBoundingClientRect();
  const end = cart.getBoundingClientRect();
  if (start.width < 2 || start.height < 2) {
    pulseCartTarget(cart);
    return;
  }

  activeFlyers += 1;

  const duration = reduced ? FLY_MS_REDUCED : FLY_MS;
  const startW = start.width;
  const startH = start.height;
  const endSize = Math.max(28, Math.min(44, Math.min(end.width, end.height) * 0.95));
  const endLeft = end.left + end.width / 2 - endSize / 2;
  const endTop = end.top + end.height / 2 - endSize / 2;

  // Arc peak — higher on tall phones so the path is visible above the thumb zone
  const midX = start.left + (endLeft - start.left) * 0.42;
  const lift = Math.min(120, Math.max(48, Math.abs(endTop - start.top) * 0.28));
  const midY = Math.min(start.top, endTop) - lift;

  const clone = document.createElement('img');
  clone.src = src;
  clone.alt = '';
  clone.setAttribute('aria-hidden', 'true');
  clone.referrerPolicy = 'no-referrer';
  clone.draggable = false;
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${start.left}px`,
    top: `${start.top}px`,
    width: `${startW}px`,
    height: `${startH}px`,
    objectFit: 'contain',
    borderRadius: '14px',
    zIndex: '10050',
    pointerEvents: 'none',
    margin: '0',
    padding: '0',
    boxShadow: '0 18px 44px rgba(10,10,10,0.28)',
    background: 'rgba(255,255,255,0.92)',
    border: '1px solid rgba(229,229,229,0.95)',
    transformOrigin: 'top left',
    transform: 'translate3d(0,0,0) scale(1)',
    opacity: '1',
    willChange: 'transform, opacity',
    backfaceVisibility: 'hidden',
  } as CSSStyleDeclaration);

  document.body.appendChild(clone);

  // Precompute transform deltas (GPU-friendly — no layout thrash)
  const scaleMid = 0.72;
  const scaleEnd = endSize / Math.max(startW, 1);
  const dxMid = midX - start.left;
  const dyMid = midY - start.top;
  const dxEnd = endLeft - start.left;
  const dyEnd = endTop - start.top;

  const animation = clone.animate(
    [
      // Hold briefly so the user notices the pick-up
      {
        transform: 'translate3d(0px, 0px, 0) scale(1)',
        opacity: 1,
        offset: 0,
      },
      {
        transform: 'translate3d(0px, -10px, 0) scale(1.04)',
        opacity: 1,
        offset: 0.12,
      },
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
        opacity: 0.4,
        offset: 1,
      },
    ],
    {
      duration,
      // Slow start + smooth settle so the flight is easy to watch
      easing: 'cubic-bezier(0.33, 0.05, 0.2, 1)',
      fill: 'forwards',
    },
  );

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
