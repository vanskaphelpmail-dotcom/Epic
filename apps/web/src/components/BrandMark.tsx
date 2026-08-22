type BrandMarkProps = {
  className?: string;
  imgClassName?: string;
};

/** Epic Vanskap mark — red geometric logo on black. */
export function BrandMark({ className = '', imgClassName = 'w-8 h-8 sm:w-9 sm:h-9' }: BrandMarkProps) {
  return (
    <div
      className={`flex-shrink-0 bg-black p-1.5 rounded-xl border border-zinc-800 overflow-hidden ${className}`}
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
