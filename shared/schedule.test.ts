import { describe, expect, it } from 'vitest';
import type { Panelist } from './types';
import { buildConfirmationText, buildSessions, findConflicts, slotKey, slotsOverlap, sortChronological, validateSelections } from './schedule';

const panel: Panelist[] = [
  { panelist_id: 'pan-erin', name: 'Erin Schaefer', slots: [
    { slot_id: 'slot-e1', date: '2026-10-27', start: '10:00', end: '10:45' },
    { slot_id: 'slot-e3', date: '2026-10-28', start: '09:00', end: '09:45' },
    { slot_id: 'slot-e4', date: '2026-10-28', start: '13:00', end: '13:45' },
  ] },
  { panelist_id: 'pan-sarah', name: 'Sarah Teller', slots: [
    { slot_id: 'slot-s1', date: '2026-10-27', start: '10:30', end: '11:15' },
    { slot_id: 'slot-s3', date: '2026-10-28', start: '10:00', end: '10:45' },
    { slot_id: 'slot-s4', date: '2026-10-28', start: '13:00', end: '13:45' },
  ] },
  { panelist_id: 'pan-john', name: 'John Doe', slots: [
    { slot_id: 'slot-j1', date: '2026-10-27', start: '11:00', end: '11:45' },
    { slot_id: 'slot-j3', date: '2026-10-28', start: '11:00', end: '11:45' },
    { slot_id: 'slot-jb', date: '2026-10-28', start: '10:45', end: '11:30' },
  ] },
];

describe('overlap', () => {
  it('treats back-to-back as fine and intersecting as overlap', () => {
    const a = { date: '2026-10-28', start: '10:00', end: '10:45' };
    expect(slotsOverlap(a, { date: '2026-10-28', start: '10:45', end: '11:30' })).toBe(false);
    expect(slotsOverlap(a, { date: '2026-10-28', start: '10:30', end: '11:15' })).toBe(true);
    expect(slotsOverlap(a, { date: '2026-10-29', start: '10:00', end: '10:45' })).toBe(false);
  });

  it('marks other panel members\' overlapping slots, never the same member\'s', () => {
    const conflicts = findConflicts(panel, { 'pan-erin': 'slot-e1' });
    expect(conflicts.get(slotKey('pan-sarah', 'slot-s1'))?.name).toBe('Erin Schaefer');
    expect(conflicts.has(slotKey('pan-erin', 'slot-e3'))).toBe(false);
    expect(conflicts.has(slotKey('pan-john', 'slot-j1'))).toBe(false);
    // Changing the pick frees them again.
    expect(findConflicts(panel, { 'pan-erin': 'slot-e3' }).has(slotKey('pan-sarah', 'slot-s1'))).toBe(false);
  });

  it('sorts chronologically', () => {
    expect(sortChronological(panel[1].slots.slice().reverse()).map((s) => s.slot_id)).toEqual(['slot-s1', 'slot-s3', 'slot-s4']);
  });
});

describe('validateSelections', () => {
  const good = [
    { panelist_id: 'pan-erin', slot_id: 'slot-e3' },
    { panelist_id: 'pan-sarah', slot_id: 'slot-s3' },
    { panelist_id: 'pan-john', slot_id: 'slot-jb' }, // back-to-back with s3
  ];
  it('accepts one non-overlapping slot per member', () => {
    expect(validateSelections(panel, good).ok).toBe(true);
  });
  it.each([
    ['missing member', good.slice(0, 2)],
    ['extra entry', [...good, { panelist_id: 'pan-erin', slot_id: 'slot-e4' }]],
    ['unknown member', [...good.slice(0, 2), { panelist_id: 'pan-x', slot_id: 'slot-j3' }]],
    ['slot of another member', [...good.slice(0, 2), { panelist_id: 'pan-john', slot_id: 'slot-e1' }]],
    ['overlap', [{ panelist_id: 'pan-erin', slot_id: 'slot-e4' }, { panelist_id: 'pan-sarah', slot_id: 'slot-s4' }, good[2]]],
    ['not an array', 'nope'],
    ['bad item', [...good.slice(0, 2), { panelist_id: 'pan-john', slot_id: 3 }]],
  ])('rejects %s', (_label, input) => {
    expect(validateSelections(panel, input).ok).toBe(false);
  });
});

describe('confirmation text', () => {
  it('matches the contract format, chronological', () => {
    const sessions = buildSessions(panel, [
      { panelist_id: 'pan-john', slot_id: 'slot-j3' },
      { panelist_id: 'pan-erin', slot_id: 'slot-e3' },
      { panelist_id: 'pan-sarah', slot_id: 'slot-s3' },
    ]);
    expect(buildConfirmationText('SCHED-1234', sessions, 'America/Detroit')).toBe(
      'Case SCHED-1234 — Erin Schaefer Wed Oct 28, 2026 9:00-9:45 AM; Sarah Teller Wed Oct 28, 2026 10:00-10:45 AM; John Doe Wed Oct 28, 2026 11:00-11:45 AM (Eastern)',
    );
  });
});
