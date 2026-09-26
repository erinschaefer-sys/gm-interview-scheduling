// LOCAL STAND-IN for @ema/design-system Button. Swap for the DS component
// when porting; keep the aria-disabled behavior (a disabled Submit must stay
// focusable so its helper text is reachable).
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Icons';

type Variant = 'primary' | 'secondary';
type Size = 'md' | 'sm';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  variant?: Variant;
  size?: Size;
  /** Renders aria-disabled and ignores clicks, but stays in the tab order. */
  inactive?: boolean;
  pending?: boolean;
  children: ReactNode;
}

const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';
const variants: Record<Variant, string> = {
  primary: 'bg-brand-primary text-brand-primary-foreground hover:bg-brand-primary-hover aria-disabled:bg-muted-border aria-disabled:text-muted-foreground aria-disabled:hover:bg-muted-border aria-disabled:cursor-not-allowed',
  secondary: 'border border-muted-border bg-surface text-foreground hover:bg-muted-bg',
};
const sizes: Record<Size, string> = { md: 'min-h-12 px-5 text-base', sm: 'min-h-9 px-3 text-sm' };

export function Button({ variant = 'primary', size = 'md', inactive, pending, className = '', onClick, children, ...rest }: ButtonProps) {
  const blocked = inactive || pending;
  return (
    <button
      type="button"
      {...rest}
      aria-disabled={blocked || undefined}
      aria-busy={pending || undefined}
      className={`${base} ${variants[variant]} ${sizes[size]} ${pending ? 'cursor-progress' : ''} ${className}`}
      onClick={(e) => { if (blocked) { e.preventDefault(); return; } onClick?.(e); }}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}
