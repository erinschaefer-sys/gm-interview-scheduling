import type { BookingResult, CaseView, SelectionRequest } from '../../shared/types';
import { parseBookingResult, parseCaseView } from '../../shared/validate';
import { api, isAxiosError } from './axios-instance';

export type LoadResult = { kind: 'ok'; data: CaseView } | { kind: 'not_found' } | { kind: 'error' };

export type SubmitResult =
  | { kind: 'booked'; result: BookingResult }
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | { kind: 'error' };

export async function fetchCase(caseId: string, token: string): Promise<LoadResult> {
  try {
    const res = await api.get('/api/public/case', { params: { case: caseId, token } });
    const data = parseCaseView(res.data);
    return data ? { kind: 'ok', data } : { kind: 'error' };
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 404) return { kind: 'not_found' };
    return { kind: 'error' };
  }
}

export async function submitSelections(request: SelectionRequest): Promise<SubmitResult> {
  try {
    const res = await api.post('/api/public/selection', request);
    const result = parseBookingResult(res.data);
    return result ? { kind: 'booked', result } : { kind: 'error' };
  } catch (err) {
    const status = isAxiosError(err) ? err.response?.status : undefined;
    if (status === 404) return { kind: 'not_found' };
    if (status === 409) return { kind: 'expired' };
    // 400 means our picks no longer match the case; the retry path re-checks status first.
    return { kind: 'error' };
  }
}
