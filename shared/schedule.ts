import type { Panelist, Selection, Session, Slot } from './types';
import { formatDateReference, formatTimeRange, timeZoneShortLabel, toMinutes } from './time';

/** panelist_id → slot_id */
export type SelectionMap = Record<string, string>;

export function slotKey(panelistId: string, slotId: string): string {
  return `${panelistId}\u0000${slotId}`;
}

export function compareChronological(a: { date: string; start: string; end?: string }, b: { date: string; start: string; end?: string }): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const byStart = toMinutes(a.start) - toMinutes(b.start);
  if (byStart !== 0) return byStart;
  return a.end && b.end ? toMinutes(a.end) - toMinutes(b.end) : 0;
}

export function sortChronological<T extends { date: string; start: string; end?: string }>(items: readonly T[]): T[] {
  return [...items].sort(compareChronological);
}

/** Same date and intersecting ranges. Back-to-back (10:45 end, 10:45 start) is not an overlap. */
export function slotsOverlap(a: Pick<Slot, 'date' | 'start' | 'end'>, b: Pick<Slot, 'date' | 'start' | 'end'>): boolean {
  return a.date === b.date && toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
}

export function findSlot(panel: readonly Panelist[], panelistId: string, slotId: string): Slot | undefined {
  return panel.find((p) => p.panelist_id === panelistId)?.slots.find((s) => s.slot_id === slotId);
}

/**
 * Slots that clash with a pick already made for a *different* panel member.
 * Keyed by slotKey; the value is the panel member whose pick causes the clash.
 */
export function findConflicts(panel: readonly Panelist[], selections: SelectionMap): Map<string, Panelist> {
  const picked = panel
    .map((p) => ({ panelist: p, slot: selections[p.panelist_id] ? findSlot(panel, p.panelist_id, selections[p.panelist_id]) : undefined }))
    .filter((x): x is { panelist: Panelist; slot: Slot } => Boolean(x.slot));

  const conflicts = new Map<string, Panelist>();
  for (const panelist of panel) {
    for (const slot of panelist.slots) {
      if (selections[panelist.panelist_id] === slot.slot_id) continue;
      const clash = picked.find((x) => x.panelist.panelist_id !== panelist.panelist_id && slotsOverlap(slot, x.slot));
      if (clash) conflicts.set(slotKey(panelist.panelist_id, slot.slot_id), clash.panelist);
    }
  }
  return conflicts;
}

export function missingPanelists(panel: readonly Panelist[], selections: SelectionMap): Panelist[] {
  return panel.filter((p) => !selections[p.panelist_id]);
}

export function toSelectionList(panel: readonly Panelist[], selections: SelectionMap): Selection[] {
  return panel
    .filter((p) => selections[p.panelist_id])
    .map((p) => ({ panelist_id: p.panelist_id, slot_id: selections[p.panelist_id] }));
}

export type SelectionValidation = { ok: true; selections: Selection[] } | { ok: false; reason: string };

/** Server-side rules from brief §5: one per panel member, no extras, slot belongs, no overlaps. */
export function validateSelections(panel: readonly Panelist[], input: unknown): SelectionValidation {
  if (!Array.isArray(input)) return { ok: false, reason: 'selections must be an array' };

  const seen = new Set<string>();
  const chosen: { panelist_id: string; slot: Slot }[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') return { ok: false, reason: 'selection must be an object' };
    const { panelist_id, slot_id } = item as Record<string, unknown>;
    if (typeof panelist_id !== 'string' || typeof slot_id !== 'string') {
      return { ok: false, reason: 'selection needs panelist_id and slot_id strings' };
    }
    const panelist = panel.find((p) => p.panelist_id === panelist_id);
    if (!panelist) return { ok: false, reason: 'unknown panel member' };
    if (seen.has(panelist_id)) return { ok: false, reason: 'more than one selection for a panel member' };
    seen.add(panelist_id);
    const slot = panelist.slots.find((s) => s.slot_id === slot_id);
    if (!slot) return { ok: false, reason: 'slot does not belong to panel member' };
    chosen.push({ panelist_id, slot });
  }
  if (seen.size !== panel.length) return { ok: false, reason: 'a selection is required for every panel member' };

  for (let i = 0; i < chosen.length; i++) {
    for (let j = i + 1; j < chosen.length; j++) {
      if (slotsOverlap(chosen[i].slot, chosen[j].slot)) return { ok: false, reason: 'selected slots overlap' };
    }
  }
  return { ok: true, selections: chosen.map((c) => ({ panelist_id: c.panelist_id, slot_id: c.slot.slot_id })) };
}

export function buildSessions(panel: readonly Panelist[], selections: readonly Selection[]): Session[] {
  const sessions = selections.map((sel) => {
    const panelist = panel.find((p) => p.panelist_id === sel.panelist_id);
    const slot = panelist?.slots.find((s) => s.slot_id === sel.slot_id);
    if (!panelist || !slot) throw new Error('selection not on case');
    return { panelist_id: panelist.panelist_id, name: panelist.name, slot_id: slot.slot_id, date: slot.date, start: slot.start, end: slot.end };
  });
  return sortChronological(sessions);
}

/** Exactly the brief §5 format, sessions in chronological order. */
export function buildConfirmationText(caseId: string, sessions: readonly Session[], timeZone: string): string {
  const ordered = sortChronological(sessions);
  const parts = ordered.map((s) => `${s.name} ${formatDateReference(s.date)} ${formatTimeRange(s.start, s.end, '-')}`);
  return `Case ${caseId} — ${parts.join('; ')} (${timeZoneShortLabel(timeZone, ordered[0]?.date)})`;
}
