// Local-review fixture (brief §10). Same response shapes as the AI Employees,
// served through the same routes. State lives in memory: restart the dev
// server to reset it.
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Confirmation, Panelist, SelectionRequest } from '../../shared/types';
import { buildConfirmationText, buildSessions } from '../../shared/schedule';
import type { CaseSource } from './types';

const PANEL: Panelist[] = [
  {
    panelist_id: 'pan-erin',
    name: 'Erin Schaefer',
    slots: [
      { slot_id: 'slot-e1', date: '2026-10-27', start: '10:00', end: '10:45' },
      { slot_id: 'slot-e2', date: '2026-10-27', start: '14:00', end: '14:45' },
      { slot_id: 'slot-e3', date: '2026-10-28', start: '09:00', end: '09:45' },
      { slot_id: 'slot-e4', date: '2026-10-28', start: '13:00', end: '13:45' },
      { slot_id: 'slot-e5', date: '2026-10-29', start: '11:00', end: '11:45' },
    ],
  },
  {
    panelist_id: 'pan-sarah',
    name: 'Sarah Teller',
    slots: [
      // Deliberately out of order: the app must sort chronologically.
      { slot_id: 'slot-s3', date: '2026-10-28', start: '10:00', end: '10:45' },
      { slot_id: 'slot-s1', date: '2026-10-27', start: '10:30', end: '11:15' },
      { slot_id: 'slot-s2', date: '2026-10-27', start: '15:00', end: '15:45' },
      { slot_id: 'slot-s4', date: '2026-10-28', start: '13:00', end: '13:45' },
      { slot_id: 'slot-s5', date: '2026-10-29', start: '14:00', end: '14:45' },
    ],
  },
  {
    panelist_id: 'pan-john',
    name: 'John Doe',
    slots: [
      { slot_id: 'slot-j1', date: '2026-10-27', start: '11:00', end: '11:45' },
      { slot_id: 'slot-j2', date: '2026-10-27', start: '16:00', end: '16:45' },
      { slot_id: 'slot-j3', date: '2026-10-28', start: '11:00', end: '11:45' },
      { slot_id: 'slot-j4', date: '2026-10-28', start: '14:00', end: '14:45' },
      { slot_id: 'slot-j5', date: '2026-10-29', start: '11:30', end: '12:15' },
    ],
  },
];

type Behavior = 'normal' | 'lookup-fails-odd' | 'booking-fails-first' | 'slot-taken-first';

interface FixtureCase {
  token: string;
  status: 'open' | 'submitted' | 'expired';
  behavior: Behavior;
  confirmation?: Confirmation;
  taken: Set<string>;
  lookups: number;
  bookings: number;
}

const BASE = {
  candidate_name: 'Daniel Okafor',
  requisition_title: 'Senior Battery Systems Engineer',
  timezone: 'America/Detroit',
};

function confirm(caseId: string, selections: SelectionRequest['selections']): Confirmation {
  const sessions = buildSessions(PANEL, selections);
  return { status: 'confirmed', sessions, confirmation_text: buildConfirmationText(caseId, sessions, BASE.timezone) };
}

function seed(): Map<string, FixtureCase> {
  const c = (token: string, status: FixtureCase['status'], behavior: Behavior = 'normal'): FixtureCase =>
    ({ token, status, behavior, taken: new Set(), lookups: 0, bookings: 0 });
  const submitted = c('demo-submitted', 'submitted');
  submitted.confirmation = confirm('SCHED-1235', [
    { panelist_id: 'pan-erin', slot_id: 'slot-e3' },
    { panelist_id: 'pan-sarah', slot_id: 'slot-s3' },
    { panelist_id: 'pan-john', slot_id: 'slot-j3' },
  ]);
  return new Map([
    ['SCHED-1234', c('demo-open', 'open')],
    ['SCHED-1235', submitted],
    ['SCHED-1236', c('demo-expired', 'expired')],
    ['SCHED-1237', c('demo-error', 'open', 'lookup-fails-odd')],
    ['SCHED-1238', c('demo-booking-fails', 'open', 'booking-fails-first')],
    ['SCHED-1239', c('demo-slot-taken', 'open', 'slot-taken-first')],
  ]);
}

function tokensMatch(expected: string, given: string): boolean {
  const a = createHash('sha256').update(expected).digest();
  const b = createHash('sha256').update(given).digest();
  return timingSafeEqual(a, b);
}

export interface FixtureOptions {
  lookupLatencyMs?: number;
  bookingLatencyMs?: number;
}

export function createFixtureSource(options: FixtureOptions = {}): CaseSource & { bookingCalls: () => number } {
  const lookupMs = options.lookupLatencyMs ?? 600;
  const bookingMs = options.bookingLatencyMs ?? 3000;
  const cases = seed();
  let bookingCalls = 0;
  const wait = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

  const find = (caseId: string, token: string) => {
    const record = cases.get(caseId);
    return record && tokensMatch(record.token, token) ? record : undefined;
  };

  return {
    bookingCalls: () => bookingCalls,

    async lookup(caseId, token) {
      await wait(lookupMs);
      const record = find(caseId, token);
      if (!record) return null;
      record.lookups += 1;
      // demo-error: every odd attempt fails, so the first load errors and Try again works.
      if (record.behavior === 'lookup-fails-odd' && record.lookups % 2 === 1) {
        throw new Error('fixture: simulated lookup failure');
      }
      return {
        case_id: caseId,
        ...BASE,
        status: record.status,
        panel: PANEL.map((p) => ({ ...p, slots: p.slots.filter((s) => !record.taken.has(s.slot_id)) })),
        ...(record.status === 'submitted' && record.confirmation ? { confirmation: record.confirmation } : {}),
      };
    },

    async book(request) {
      bookingCalls += 1;
      await wait(bookingMs);
      const record = find(request.case_id, request.token);
      if (!record) throw new Error('fixture: booking for unknown case');
      if (record.status === 'submitted' && record.confirmation) return record.confirmation;
      record.bookings += 1;

      if (record.behavior === 'booking-fails-first' && record.bookings === 1) {
        throw new Error('fixture: simulated booking failure');
      }
      if (record.behavior === 'slot-taken-first' && record.bookings === 1) {
        const sarah = request.selections.find((s) => s.panelist_id === 'pan-sarah');
        if (sarah) {
          record.taken.add(sarah.slot_id);
          return { status: 'slot_unavailable', unavailable_slot_ids: [sarah.slot_id] };
        }
      }
      const gone = request.selections.filter((s) => record.taken.has(s.slot_id)).map((s) => s.slot_id);
      if (gone.length > 0) return { status: 'slot_unavailable', unavailable_slot_ids: gone };

      record.status = 'submitted';
      record.confirmation = confirm(request.case_id, request.selections);
      return record.confirmation;
    },
  };
}
