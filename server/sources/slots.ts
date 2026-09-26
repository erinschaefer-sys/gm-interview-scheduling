import type { EmuClientLike } from '../platform/emu-client';
import type { CaseSource } from './types';

export const CASE_LOOKUP_SLOT = 'CASE_LOOKUP_AIE';
export const BOOKING_SLOT = 'BOOKING_AIE';

function unwrap(output: unknown): unknown {
  // ASSUMPTION (open question): the workflow's output is the contract JSON,
  // either as the object itself or as a JSON string. Confirm against the
  // AIEs' output fields once they're rewritten.
  if (typeof output === 'string') {
    try { return JSON.parse(output); } catch { return output; }
  }
  return output;
}

export function createSlotsSource(emu: EmuClientLike, timeoutMs: number): CaseSource {
  return {
    async lookup(caseId, token) {
      const out = unwrap(await emu.runWorkflow(CASE_LOOKUP_SLOT, { case_id: caseId, token }, { timeoutMs }));
      // ASSUMPTION: the lookup AIE signals a missing case or wrong token with
      // null/empty output or { status: "not_found" }.
      if (out == null || (typeof out === 'object' && (Object.keys(out).length === 0 || (out as { status?: unknown }).status === 'not_found'))) {
        return null;
      }
      return out;
    },
    async book(request) {
      return unwrap(await emu.runWorkflow(BOOKING_SLOT, { ...request }, { timeoutMs }));
    },
  };
}
