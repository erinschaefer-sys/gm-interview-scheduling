// LOCAL STAND-IN for @ema/design-system Skeleton.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse motion-reduce:animate-none rounded-md bg-skeleton ${className}`} />;
}
