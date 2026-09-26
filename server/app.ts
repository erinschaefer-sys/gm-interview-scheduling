import { Hono, type Context } from 'hono';
import type { BookingResult, CaseView, Confirmation } from '../shared/types';
import { sortChronological, validateSelections } from '../shared/schedule';
import { isValidCaseId, isValidToken, parseBookingResult, parseCaseView } from '../shared/validate';
import { recordAudit as defaultAudit, type RecordAudit } from './platform/audit';
import { rateLimit } from './rate-limit';
import type { CaseSource } from './sources/types';

export const REQUEST_TIMEOUT_MS = 45_000;

export interface Logger {
  info(message: string): void;
  error(message: string): void;
}

/**
 * App-side record of confirmations. ASSUMPTION: in-memory, per process. The
 * Ema template ships a MongoDB model layer; when porting, back this with a
 * model (see the template's db-model.md) so a restart or second pod still
 * short-circuits repeat submits.
 */
export interface ConfirmationStore {
  get(caseId: string): Confirmation | undefined;
  set(caseId: string, confirmation: Confirmation): void;
}

export function memoryStore(): ConfirmationStore {
  const m = new Map<string, Confirmation>();
  return { get: (k) => m.get(k), set: (k, v) => void m.set(k, v) };
}

export interface AppDeps {
  source: CaseSource;
  timeoutMs?: number;
  rateLimitPerMinute?: number;
  audit?: RecordAudit;
  logger?: Logger;
  store?: ConfirmationStore;
}

class TimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new TimeoutError('timed out')), ms); }),
  ]).finally(() => clearTimeout(timer));
}

/** Strips any occurrence of the token before a message reaches the log. */
function redact(message: string, token?: string): string {
  return token ? message.split(token).join('[redacted]') : message;
}

function clientKey(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming;
  return incoming?.socket?.remoteAddress ?? 'unknown';
}

// One response for every "no such case / wrong token / malformed" outcome.
const notFound = (c: Context) => c.json({ error: 'not_found' }, 404);

export function createApp(deps: AppDeps) {
  const { source } = deps;
  const timeoutMs = deps.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const audit = deps.audit ?? defaultAudit;
  const logger = deps.logger ?? { info: (m) => console.info(m), error: (m) => console.error(m) };
  const store = deps.store ?? memoryStore();
  const inflight = new Map<string, Promise<BookingResult>>();

  const app = new Hono();

  // Access log: method, path and status only. Never the query string (it carries the token).
  app.use('/api/*', async (c, next) => {
    const began = Date.now();
    await next();
    logger.info(`${c.req.method} ${c.req.path} ${c.res.status} ${Date.now() - began}ms`);
  });

  app.use('/api/public/*', rateLimit({ limit: deps.rateLimitPerMinute ?? 60, windowMs: 60_000, keyOf: clientKey }));

  async function loadCase(caseId: string, token: string): Promise<CaseView | null | 'error'> {
    try {
      const raw = await withTimeout(source.lookup(caseId, token), timeoutMs);
      if (raw == null) return null;
      const view = parseCaseView(raw);
      if (!view) {
        logger.error(`case lookup returned an unexpected shape for ${caseId}`);
        return 'error';
      }
      view.panel = view.panel.map((p) => ({ ...p, slots: sortChronological(p.slots) }));
      return view;
    } catch (err) {
      logger.error(redact(`case lookup failed for ${caseId}: ${(err as Error).message}`, token));
      return 'error';
    }
  }

  app.get('/api/public/case', async (c) => {
    const caseId = c.req.query('case');
    const token = c.req.query('token');
    if (!isValidCaseId(caseId) || !isValidToken(token)) return notFound(c);

    const view = await loadCase(caseId, token);
    if (view === null) return notFound(c);
    if (view === 'error') return c.json({ error: 'lookup_failed' }, 502);
    return c.json(view);
  });

  app.post('/api/public/selection', async (c) => {
    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid_body' }, 400);
    }
    if (!body || typeof body !== 'object') return c.json({ error: 'invalid_body' }, 400);
    const { case_id: caseId, token, selections } = body;
    if (!isValidCaseId(caseId) || !isValidToken(token)) return notFound(c);

    // The lookup doubles as the token check, so it runs before any shortcut.
    const view = await loadCase(caseId, token);
    if (view === null) return notFound(c);
    if (view === 'error') return c.json({ error: 'lookup_failed' }, 502);

    // Idempotency, layer 1: already booked → return the stored confirmation, book nothing.
    const stored = store.get(caseId) ?? (view.status === 'submitted' ? view.confirmation : undefined);
    if (stored) return c.json(stored);
    if (view.status === 'expired') return c.json({ status: 'expired' }, 409);
    if (view.status !== 'open') return c.json({ error: 'unexpected_status' }, 502);

    const checked = validateSelections(view.panel, selections);
    if (!checked.ok) return c.json({ error: 'invalid_selection', reason: checked.reason }, 400);

    // Layer 2: a booking for this case is already in flight → share it. No
    // await sits between here and inflight.set below, so two requests landing
    // together cannot both start a booking.
    const raced = inflight.get(caseId);
    if (raced) return respondWithBooking(c, raced, token);

    const booking = (async (): Promise<BookingResult> => {
      const raw = await withTimeout(source.book({ case_id: caseId, token, selections: checked.selections }), timeoutMs);
      const result = parseBookingResult(raw);
      if (!result) throw new Error('booking returned an unexpected shape');
      if (result.status === 'confirmed') store.set(caseId, result);
      await audit({
        action: 'interview_selection.submit',
        resource: { type: 'scheduling_case', id: caseId },
        outcome: result.status,
        metadata: result.status === 'confirmed'
          ? { slot_ids: checked.selections.map((s) => s.slot_id) }
          : { unavailable_slot_ids: result.unavailable_slot_ids },
      });
      return result;
    })().finally(() => inflight.delete(caseId));
    inflight.set(caseId, booking);

    return respondWithBooking(c, booking, token);
  });

  async function respondWithBooking(c: Context, booking: Promise<BookingResult>, token: string) {
    try {
      return c.json(await booking);
    } catch (err) {
      const timedOut = err instanceof TimeoutError;
      logger.error(redact(`booking failed: ${(err as Error).message}`, token));
      return c.json({ error: timedOut ? 'booking_timeout' : 'booking_failed' }, timedOut ? 504 : 502);
    }
  }

  return app;
}
