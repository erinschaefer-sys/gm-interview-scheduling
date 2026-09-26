import type { SelectionRequest } from '../../shared/types';

/**
 * Where case data comes from. `slots` calls the bound AI Employees;
 * `fixture` serves seeded demo cases. Both go through the same routes,
 * validation and 404 rules.
 */
export interface CaseSource {
  /** Raw lookup payload, or null when the case/token pair doesn't match. */
  lookup(caseId: string, token: string): Promise<unknown | null>;
  /** Raw booking payload (confirmed or slot_unavailable). */
  book(request: SelectionRequest): Promise<unknown>;
}
