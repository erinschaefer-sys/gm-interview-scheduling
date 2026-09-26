// LOCAL STAND-IN for @ema/design-system Card.
import type { HTMLAttributes, ReactNode } from 'react';

export function Card({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...rest} className={`rounded-xl border border-muted-border bg-surface p-5 ${className}`}>
      {children}
    </div>
  );
}
