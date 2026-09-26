import type { BookingResult, CaseView, Confirmation, Panelist, Session, Slot } from './types';
import { isDate, isTime, toMinutes } from './time';

// Deliberately permissive about the exact id format (the AI Employees own it),
// strict about shape so junk never reaches the lookup.
const CASE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const TOKEN_RE = /^[A-Za-z0-9._~-]{1,512}$/;

export function isValidCaseId(value: unknown): value is string {
  return typeof value === 'string' && CASE_ID_RE.test(value);
}

export function isValidToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_RE.test(value);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

function parseSlot(raw: unknown): Slot | null {
  if (!isObj(raw)) return null;
  const { slot_id, date, start, end } = raw;
  if (!isStr(slot_id) || !isDate(date) || !isTime(start) || !isTime(end)) return null;
  if (toMinutes(start) >= toMinutes(end)) return null;
  return { slot_id, date, start, end };
}

function parsePanelist(raw: unknown): Panelist | null {
  if (!isObj(raw) || !isStr(raw.panelist_id) || !isStr(raw.name) || !Array.isArray(raw.slots)) return null;
  const slots: Slot[] = [];
  for (const s of raw.slots) {
    const slot = parseSlot(s);
    if (!slot) return null;
    slots.push(slot);
  }
  return { panelist_id: raw.panelist_id, name: raw.name, slots };
}

function parseSession(raw: unknown): Session | null {
  if (!isObj(raw) || !isStr(raw.panelist_id) || !isStr(raw.name)) return null;
  const slot = parseSlot(raw);
  return slot ? { panelist_id: raw.panelist_id, name: raw.name, ...slot } : null;
}

export function parseConfirmation(raw: unknown): Confirmation | null {
  if (!isObj(raw) || raw.status !== 'confirmed' || !Array.isArray(raw.sessions) || typeof raw.confirmation_text !== 'string') return null;
  const sessions: Session[] = [];
  for (const s of raw.sessions) {
    const session = parseSession(s);
    if (!session) return null;
    sessions.push(session);
  }
  return { status: 'confirmed', sessions, confirmation_text: raw.confirmation_text };
}

export function parseBookingResult(raw: unknown): BookingResult | null {
  if (isObj(raw) && raw.status === 'slot_unavailable') {
    const ids = raw.unavailable_slot_ids;
    if (!Array.isArray(ids) || !ids.every(isStr)) return null;
    return { status: 'slot_unavailable', unavailable_slot_ids: ids };
  }
  return parseConfirmation(raw);
}

/** Validates the lookup payload. Unknown `status` strings pass through so the UI can show the error state. */
export function parseCaseView(raw: unknown): CaseView | null {
  if (!isObj(raw)) return null;
  const { case_id, candidate_name, requisition_title, timezone, status, panel } = raw;
  if (!isStr(case_id) || !isStr(candidate_name) || !isStr(requisition_title) || !isStr(timezone) || !isStr(status)) return null;
  if (!Array.isArray(panel)) return null;
  const members: Panelist[] = [];
  for (const p of panel) {
    const member = parsePanelist(p);
    if (!member) return null;
    members.push(member);
  }
  const view: CaseView = { case_id, candidate_name, requisition_title, timezone, status, panel: members };
  if (status === 'submitted') {
    const confirmation = parseConfirmation(raw.confirmation);
    if (!confirmation) return null;
    view.confirmation = confirmation;
  }
  return view;
}
