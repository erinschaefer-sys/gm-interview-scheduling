// One single-choice group per panel member (radiogroup / radio).
// Keyboard (brief §6): Tab moves between groups, arrow keys move within a
// group, Space selects. Unavailable slots stay focusable so screen-reader
// users hear the reason, but can't be selected.
//
// Hand-rolled because the local build has no @ema/design-system. When
// porting, use the DS radio-card group if it supports aria-disabled options
// with a description; otherwise keep this component.
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Panelist, Slot } from '../../shared/types';
import { formatDateShort, formatTimeRange } from '../../shared/time';
import { slotKey } from '../../shared/schedule';
import { firstName } from '../copy';
import { Badge } from './ds/Badge';
import { CheckIcon } from './ds/Icons';

interface PanelSectionProps {
  panelist: Panelist;
  selectedSlotId?: string;
  conflicts: Map<string, Panelist>;
  taken: Set<string>;
  locked: boolean;
  onSelect: (panelistId: string, slotId: string) => void;
}

export function PanelSection({ panelist, selectedSlotId, conflicts, taken, locked, onSelect }: PanelSectionProps) {
  const headingId = useId();
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);

  const selectedIndex = panelist.slots.findIndex((s) => s.slot_id === selectedSlotId);
  const tabStop = selectedIndex >= 0 ? selectedIndex : Math.min(focusIndex, panelist.slots.length - 1);

  const reasonFor = (slot: Slot): string | null => {
    const key = slotKey(panelist.panelist_id, slot.slot_id);
    if (taken.has(key)) return 'No longer available';
    const other = conflicts.get(key);
    return other ? `Overlaps your time with ${firstName(other.name)}` : null;
  };

  const move = (to: number) => {
    const n = panelist.slots.length;
    const index = (to + n) % n;
    setFocusIndex(index);
    refs.current[index]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number, slot: Slot) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault(); move(index + 1); break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault(); move(index - 1); break;
      case 'Home':
        e.preventDefault(); move(0); break;
      case 'End':
        e.preventDefault(); move(panelist.slots.length - 1); break;
      case ' ':
      case 'Enter':
        e.preventDefault();
        onSelect(panelist.panelist_id, slot.slot_id);
        break;
    }
  };

  return (
    <section aria-labelledby={headingId} className="scroll-mt-6">
      <div className="flex min-h-7 items-center gap-2">
        <h2 id={headingId} className="text-lg font-semibold">{panelist.name}</h2>
        {selectedSlotId && (
          <Badge>
            <CheckIcon className="size-3.5" />
            Selected
          </Badge>
        )}
      </div>
      <div role="radiogroup" aria-labelledby={headingId} className="mt-3 flex flex-col gap-2">
        {panelist.slots.map((slot, index) => {
          const selected = slot.slot_id === selectedSlotId;
          const reason = reasonFor(slot);
          const unavailable = reason !== null;
          const reasonId = `${headingId}-${index}-reason`;
          return (
            <div
              key={slot.slot_id}
              ref={(el) => { refs.current[index] = el; }}
              role="radio"
              aria-checked={selected}
              aria-disabled={unavailable || locked || undefined}
              aria-describedby={reason ? reasonId : undefined}
              tabIndex={index === tabStop ? 0 : -1}
              onFocus={() => setFocusIndex(index)}
              onClick={() => onSelect(panelist.panelist_id, slot.slot_id)}
              onKeyDown={(e) => onKeyDown(e, index, slot)}
              data-slot-id={slot.slot_id}
              className={[
                'flex min-h-14 w-full select-none items-center gap-3 rounded-lg border-2 px-4 py-2.5 text-left transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
                selected
                  ? 'border-brand-primary bg-brand-subtle'
                  : unavailable
                    ? 'border-dashed border-muted-border bg-muted-bg text-muted-foreground'
                    : 'border-muted-border bg-surface hover:border-brand-primary',
                unavailable ? 'cursor-not-allowed' : locked ? 'cursor-progress' : 'cursor-pointer',
              ].join(' ')}
            >
              {/* Radio indicator: filled with a check when selected, so the state never depends on color alone. */}
              <span
                aria-hidden="true"
                className={[
                  'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                  selected ? 'border-brand-primary bg-brand-primary text-brand-primary-foreground' : 'border-muted-border bg-surface',
                ].join(' ')}
              >
                {selected && <CheckIcon className="size-3.5" />}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className={unavailable ? '' : 'text-foreground'}>
                  <span className="font-semibold">{formatDateShort(slot.date)}</span>
                  <span aria-hidden="true"> · </span>
                  <span className="sr-only">, </span>
                  <span>{formatTimeRange(slot.start, slot.end)}</span>
                </span>
                {reason && (
                  <span id={reasonId} className="text-sm font-medium">{reason}</span>
                )}
              </span>
              {selected && <span className="ml-auto hidden text-sm font-semibold text-brand-primary sm:inline" aria-hidden="true">Selected</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
