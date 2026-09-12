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
   * Header: press → red, release → black. No background plate.
   */
  interactive?: boolean;
  onToneChange?: (tone: BrandMarkTone) => void;
};

/** Transparent master art (red mark, no plate). Black/white via CSS filter. */
const MARK_SRC = '/epic-vanskap-mark-red.png?v=3';

function filterForTone(tone: BrandMarkTone): string {
  if (tone === 'red') return 'none';
  if (tone === 'white') return 'brightness(0) invert(1)';
  return 'brightness(0)';
}

/** Epic Vanskap mark — transparent bg; press for red when interactive. */
export function BrandMark({
  className = '',
  imgClassName = 'w-8 h-8 sm:w-9 sm:h-9',
  tone = 'black',
  interactive = false,
  onToneChange,
}: BrandMarkProps) {
  const [pressed, setPressed] = useState(false);

  const setPress = useCallback(
    (next: boolean) => {
      setPressed(next);
      if (interactive) onToneChange?.(next ? 'red' : 'black');
    },
    [interactive, onToneChange],
  );

  const activeTone: BrandMarkTone = interactive ? (pressed ? 'red' : 'black') : tone;

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? 'Epic Vanskap logo' : undefined}
      title={interactive ? 'Hold for red' : undefined}
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
      className={`brand-mark flex-shrink-0 bg-transparent p-0 m-0 border-0 shadow-none outline-none ${
        interactive ? 'cursor-pointer select-none' : ''
      } ${className}`}
      style={{ background: 'transparent' }}
    >
      <img
        src={MARK_SRC}
        alt="Epic Vanskap"
        className={`block object-contain bg-transparent transition-[filter] duration-150 ease-out ${imgClassName}`}
        style={{ filter: filterForTone(activeTone), background: 'transparent' }}
        width={36}
        height={36}
        draggable={false}
      />
    </div>
  );
}
