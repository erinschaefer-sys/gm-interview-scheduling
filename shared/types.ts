// Wire contract with the Ema side (brief §5 and §8). Do not rename fields.

export type CaseStatus = 'open' | 'submitted' | 'expired';

export interface Slot {
  slot_id: string;
  date: string; // YYYY-MM-DD, wall-clock in the case timezone
  start: string; // HH:MM, 24h, wall-clock in the case timezone
  end: string;
}

export interface Panelist {
  panelist_id: string;
  name: string;
  slots: Slot[];
}

export interface Session {
  panelist_id: string;
  name: string;
  slot_id: string;
  date: string;
  start: string;
  end: string;
}

export interface Confirmation {
  status: 'confirmed';
  sessions: Session[];
  confirmation_text: string;
}

export interface SlotUnavailable {
  status: 'slot_unavailable';
  unavailable_slot_ids: string[];
}

export type BookingResult = Confirmation | SlotUnavailable;

export interface CaseView {
  case_id: string;
  candidate_name: string;
  requisition_title: string;
  timezone: string;
  /** Kept as a string: an unknown value must render the error state, not crash. */
  status: string;
  panel: Panelist[];
  confirmation?: Confirmation;
}

export interface Selection {
  panelist_id: string;
  slot_id: string;
}

export interface SelectionRequest {
  case_id: string;
  token: string;
  selections: Selection[];
}
