import type { CaseView, Confirmation } from '../../shared/types';

export const OPEN_CASE: CaseView = {
  case_id: 'SCHED-1234',
  candidate_name: 'Daniel Okafor',
  requisition_title: 'Senior Battery Systems Engineer',
  timezone: 'America/Detroit',
  status: 'open',
  panel: [
    { panelist_id: 'pan-erin', name: 'Erin Schaefer', slots: [
      { slot_id: 'slot-e1', date: '2026-10-27', start: '10:00', end: '10:45' },
      { slot_id: 'slot-e2', date: '2026-10-27', start: '14:00', end: '14:45' },
      { slot_id: 'slot-e3', date: '2026-10-28', start: '09:00', end: '09:45' },
    ] },
    { panelist_id: 'pan-sarah', name: 'Sarah Teller', slots: [
      { slot_id: 'slot-s1', date: '2026-10-27', start: '10:30', end: '11:15' },
      { slot_id: 'slot-s2', date: '2026-10-27', start: '15:00', end: '15:45' },
      { slot_id: 'slot-s3', date: '2026-10-28', start: '10:00', end: '10:45' },
    ] },
    { panelist_id: 'pan-john', name: 'John Doe', slots: [
      { slot_id: 'slot-j1', date: '2026-10-27', start: '11:00', end: '11:45' },
      { slot_id: 'slot-j3', date: '2026-10-28', start: '11:00', end: '11:45' },
    ] },
  ],
};

export const CONFIRMATION: Confirmation = {
  status: 'confirmed',
  sessions: [
    { panelist_id: 'pan-john', name: 'John Doe', slot_id: 'slot-j3', date: '2026-10-28', start: '11:00', end: '11:45' },
    { panelist_id: 'pan-erin', name: 'Erin Schaefer', slot_id: 'slot-e3', date: '2026-10-28', start: '09:00', end: '09:45' },
    { panelist_id: 'pan-sarah', name: 'Sarah Teller', slot_id: 'slot-s3', date: '2026-10-28', start: '10:00', end: '10:45' },
  ],
  confirmation_text: 'Case SCHED-1234 — Erin Schaefer Wed Oct 28, 2026 9:00-9:45 AM; Sarah Teller Wed Oct 28, 2026 10:00-10:45 AM; John Doe Wed Oct 28, 2026 11:00-11:45 AM (Eastern)',
};

export const LINK = '?case=SCHED-1234&token=demo-open';
