type BrandWordmarkProps = {
  /** Full brand string, e.g. "Epic Vanskap" */
  text?: string;
  className?: string;
  /** Extra classes on each word span (size overrides, etc.) */
  wordClassName?: string;
  /** On dark surfaces, second word uses white instead of black */
  onDark?: boolean;
  /** Hide trailing short badge (e.g. BD) */
  showBadge?: boolean;
};

/**
 * Official wordmark: EPIC (red) + VANSKAP (black), bold uppercase sans.
 * Matches the storefront lockup — mark shine lives on BrandMark.
 */
export function BrandWordmark({
  text = 'Epic Vanskap',
  className = '',
  wordClassName = '',
  onDark = false,
  showBadge = true,
}: BrandWordmarkProps) {
  const brand = (text || 'Epic Vanskap').trim() || 'Epic Vanskap';
  const parts = brand.split(/\s+/).filter(Boolean);
  const badge =
    showBadge && parts.length > 1 && parts[parts.length - 1].length <= 3
      ? parts[parts.length - 1]
      : null;
  const words = badge ? parts.slice(0, -1) : parts;

  return (
    <div className={`brand-logo-lockup inline-flex items-center flex-nowrap min-w-0 ${className}`}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          className={`brand-word shrink-0 ${i === 0 ? 'brand-word-epic' : 'brand-word-vanskap'} ${
            onDark && i > 0 ? 'brand-word-on-dark' : ''
          } ${wordClassName}`}
        >
          {word}
        </span>
      ))}
      {badge ? (
        <span className="brand-badge-bd shrink-0" aria-label={badge}>
          <span>{badge}</span>
        </span>
      ) : null}
    </div>
  );
}
