// LOCAL STAND-IN for @ema/design-system Badge.
import type { ReactNode } from 'react';

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-subtle px-2 py-0.5 text-xs font-semibold text-brand-primary">
      {children}
    </span>
  );
}
