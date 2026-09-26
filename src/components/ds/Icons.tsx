// Inline icons (no icon font or CDN). Decorative by default.
type IconProps = { className?: string };

export const CheckIcon = ({ className = 'size-4' }: IconProps) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true" focusable="false">
    <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ClockIcon = ({ className = 'size-4' }: IconProps) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true" focusable="false">
    <circle cx="10" cy="10" r="7.25" />
    <path d="M10 6v4.25l2.75 1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const CheckCircleIcon = ({ className = 'size-10' }: IconProps) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
    <circle cx="20" cy="20" r="19" className="fill-brand-subtle" />
    <path d="M12 20.5l5.5 5.5L28.5 15" className="stroke-brand-primary" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Spinner = ({ className = 'size-4' }: IconProps) => (
  <svg className={`${className} animate-spin motion-reduce:animate-none`} viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
    <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeOpacity={0.3} strokeWidth={2.5} />
    <path d="M17.5 10A7.5 7.5 0 0 0 10 2.5" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
  </svg>
);
