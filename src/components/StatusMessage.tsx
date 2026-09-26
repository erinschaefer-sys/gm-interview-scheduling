import type { ReactNode } from 'react';

export function StatusMessage({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      {children && <div className="mt-3 text-base text-muted-foreground">{children}</div>}
      {action && <div className="mt-8 flex justify-center">{action}</div>}
    </div>
  );
}
