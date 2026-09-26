import type { Panelist, Slot } from '../../shared/types';
import { findSlot, sortChronological, type SelectionMap } from '../../shared/schedule';
import { formatDateShort, formatTimeRange } from '../../shared/time';
import { CheckIcon } from './ds/Icons';

export function progressText(panel: readonly Panelist[], selections: SelectionMap): string {
  const done = panel.filter((p) => selections[p.panelist_id]).length;
  return `${done} of ${panel.length} interview${panel.length === 1 ? '' : 's'} selected`;
}

/** "Your schedule": picks so far, in chronological (not panel) order. */
export function ScheduleSummary({ panel, selections }: { panel: readonly Panelist[]; selections: SelectionMap }) {
  const picks = sortChronological(
    panel
      .map((p) => ({ panelist: p, slot: findSlot(panel, p.panelist_id, selections[p.panelist_id] ?? '') }))
      .filter((x): x is { panelist: Panelist; slot: Slot } => Boolean(x.slot))
      .map((x) => ({ ...x, date: x.slot.date, start: x.slot.start, end: x.slot.end })),
  );

  return (
    <div>
      <h2 className="text-base font-semibold">Your schedule</h2>
      <p className="mt-1 text-sm text-muted-foreground">{progressText(panel, selections)}</p>
      {picks.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Your picks will appear here.</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {picks.map(({ panelist, slot }) => (
            <li key={panelist.panelist_id} className="flex gap-2.5">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-brand-primary" />
              <span className="text-sm">
                <span className="block font-semibold">{formatDateShort(slot.date)} · {formatTimeRange(slot.start, slot.end)}</span>
                <span className="block text-muted-foreground">with {panelist.name}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
