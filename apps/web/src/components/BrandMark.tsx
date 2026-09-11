type BrandMarkProps = {
  className?: string;
  imgClassName?: string;
  /** No tile — for light surfaces (header, invoice). */
  bare?: boolean;
};

/** Epic Vanskap mark — red logo on light surfaces by default. */
export function BrandMark({ className = '', imgClassName = 'w-8 h-8 sm:w-9 sm:h-9', bare = true }: BrandMarkProps) {
  return (
    <div
      className={
        bare
          ? `flex-shrink-0 overflow-hidden ${className}`
          : `flex-shrink-0 bg-black p-1.5 rounded-xl border border-zinc-800 overflow-hidden ${className}`
      }
    >
      <img
        src="/epic-vanskap-logo.png?v=1"
        alt=""
        className={`object-contain ${imgClassName}`}
        width={36}
        height={36}
      />
    </div>
  );
}
