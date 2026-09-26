import { LOGO_ALT, LOGO_SRC } from '../brand';

export function Header() {
  return (
    <header className="border-b border-muted-border bg-surface">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
        <img src={LOGO_SRC} alt={LOGO_ALT} width={36} height={36} className="size-9" />
        <span className="text-sm font-medium text-muted-foreground">Careers</span>
      </div>
    </header>
  );
}
