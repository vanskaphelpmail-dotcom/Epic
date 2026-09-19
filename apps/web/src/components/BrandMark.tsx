import { useCallback, useState } from 'react';

export type BrandMarkTone = 'black' | 'red' | 'white';

type BrandMarkProps = {
  className?: string;
  imgClassName?: string;
  /** Always transparent — kept for API compat (ignored). */
  bare?: boolean;
  /**
   * Color of the geometric mark when not pressing.
   * - black: default on light UI
   * - red: cash memo / brand accents
   * - white: dark surfaces
   */
  tone?: BrandMarkTone;
  /**
   * Header: press → brighter, release → red. Keep red mark look by default.
   */
  interactive?: boolean;
  /** Soft white rounded plate behind the mark (matches official lockup). */
  framed?: boolean;
  onToneChange?: (tone: BrandMarkTone) => void;
};

/** Official red geometric mark (flat two-shard V / E shape). */
const MARK_SRC = '/epic-vanskap-mark-red.png?v=5';

function filterForTone(tone: BrandMarkTone): string {
  if (tone === 'red') return 'none';
  if (tone === 'white') return 'brightness(0) invert(1)';
  return 'brightness(0)';
}

/** Epic Vanskap mark — red icon with continuous shiny sweep. */
export function BrandMark({
  className = '',
  imgClassName = 'w-8 h-8 sm:w-9 sm:h-9',
  tone = 'red',
  interactive = false,
  framed = true,
  bare = false,
  onToneChange,
}: BrandMarkProps) {
  const [pressed, setPressed] = useState(false);
  const showFrame = framed && !bare;

  const setPress = useCallback(
    (next: boolean) => {
      setPressed(next);
      if (interactive) onToneChange?.(next ? 'red' : 'red');
    },
    [interactive, onToneChange],
  );

  // Storefront lockup stays red (matches official artwork)
  const activeTone: BrandMarkTone = tone === 'white' || tone === 'black' ? tone : 'red';

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? 'Epic Vanskap logo' : undefined}
      onPointerDown={
        interactive
          ? (e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              setPress(true);
            }
          : undefined
      }
      onPointerUp={interactive ? () => setPress(false) : undefined}
      onPointerCancel={interactive ? () => setPress(false) : undefined}
      onPointerLeave={interactive ? () => setPress(false) : undefined}
      onBlur={interactive ? () => setPress(false) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setPress(true);
              }
            }
          : undefined
      }
      onKeyUp={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setPress(false);
              }
            }
          : undefined
      }
      className={`brand-mark flex-shrink-0 outline-none ${
        showFrame ? 'brand-mark-framed' : 'bg-transparent p-0 m-0 border-0 shadow-none'
      } ${interactive ? 'cursor-pointer select-none' : ''} ${pressed ? 'brand-mark-pressed' : ''} ${className}`}
    >
      <span className="brand-mark-shine" aria-hidden />
      <img
        src={MARK_SRC}
        alt="Epic Vanskap"
        className={`brand-mark-img relative z-[1] block object-contain bg-transparent ${imgClassName}`}
        style={{ filter: filterForTone(activeTone) }}
        width={36}
        height={36}
        draggable={false}
      />
    </div>
  );
}
