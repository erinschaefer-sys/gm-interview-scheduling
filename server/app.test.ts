import { describe, expect, it, vi } from 'vitest';
import { createApp, type Logger } from './app';
import { loadConfig } from './config';
import { createFixtureSource } from './sources/fixture';
import type { CaseSource } from './sources/types';

function setup(overrides: { source?: CaseSource; rateLimitPerMinute?: number } = {}) {
  const fixture = createFixtureSource({ lookupLatencyMs: 0, bookingLatencyMs: 20 });
  const logs: string[] = [];
  const logger: Logger = { info: (m) => logs.push(m), error: (m) => logs.push(m) };
  const audits: unknown[] = [];
  const app = createApp({ source: overrides.source ?? fixture, logger, audit: (e) => void audits.push(e), rateLimitPerMinute: overrides.rateLimitPerMinute });
  const get = (qs: string) => app.request(`/api/public/case${qs}`);
  const post = (body: unknown) => app.request('/api/public/selection', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { app, fixture, logs, audits, get, post };
}

const OPEN = { case_id: 'SCHED-1234', token: 'demo-open' };
const PICKS = [
  { panelist_id: 'pan-erin', slot_id: 'slot-e3' },
  { panelist_id: 'pan-sarah', slot_id: 'slot-s3' },
  { panelist_id: 'pan-john', slot_id: 'slot-j3' },
];

describe('GET /api/public/case', () => {
  it('returns the case with slots sorted chronologically', async () => {
    const { get } = setup();
    const res = await get('?case=SCHED-1234&token=demo-open');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('open');
    expect(body.panel).toHaveLength(3);
    expect(body.panel[1].slots.map((s: { slot_id: string }) => s.slot_id)).toEqual(['slot-s1', 'slot-s2', 'slot-s3', 'slot-s4', 'slot-s5']);
  });

  it.each([
    ['wrong token', '?case=SCHED-1234&token=wrong'],
    ['unknown case', '?case=SCHED-9999&token=demo-open'],
    ['missing token', '?case=SCHED-1234'],
    ['missing case', '?token=demo-open'],
    ['malformed case', '?case=../etc&token=demo-open'],
    ['malformed token', '?case=SCHED-1234&token=%3Cscript%3E'],
    ['token for another case', '?case=SCHED-1235&token=demo-open'],
  ])('returns an identical 404 for %s', async (_label, qs) => {
    const { get } = setup();
    const res = await get(qs);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('includes the stored confirmation for a submitted case', async () => {
    const { get } = setup();
    const body = await (await get('?case=SCHED-1235&token=demo-submitted')).json();
    expect(body.status).toBe('submitted');
    expect(body.confirmation.sessions.map((s: { slot_id: string }) => s.slot_id)).toEqual(['slot-e3', 'slot-s3', 'slot-j3']);
  });

  it('maps a failing lookup to 502, and demo-error recovers on the next attempt', async () => {
    const { get } = setup();
    expect((await get('?case=SCHED-1237&token=demo-error')).status).toBe(502);
    expect((await get('?case=SCHED-1237&token=demo-error')).status).toBe(200);
  });

  it('never logs the token', async () => {
    const { get, logs } = setup();
    await get('?case=SCHED-1234&token=demo-open');
    await get('?case=SCHED-1237&token=demo-error');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.join('\n')).not.toMatch(/demo-open|demo-error/);
  });

  it('rate-limits at 60 requests per minute', async () => {
    const { get } = setup();
    for (let i = 0; i < 60; i++) expect((await get('?case=SCHED-1234&token=wrong')).status).toBe(404);
    expect((await get('?case=SCHED-1234&token=wrong')).status).toBe(429);
  });
});

describe('POST /api/public/selection', () => {
  it('books and returns the confirmation; a reload then shows submitted', async () => {
    const { post, get, audits } = setup();
    const res = await post({ ...OPEN, selections: PICKS });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('confirmed');
    expect(body.confirmation_text).toBe('Case SCHED-1234 — Erin Schaefer Wed Oct 28, 2026 9:00-9:45 AM; Sarah Teller Wed Oct 28, 2026 10:00-10:45 AM; John Doe Wed Oct 28, 2026 11:00-11:45 AM (Eastern)');
    expect((await (await get('?case=SCHED-1234&token=demo-open')).json()).status).toBe('submitted');
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits)).not.toContain('demo-open');
  });

  it('two concurrent POSTs produce exactly one booking', async () => {
    const { post, fixture } = setup();
    const [a, b] = await Promise.all([post({ ...OPEN, selections: PICKS }), post({ ...OPEN, selections: PICKS })]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect((await a.json()).confirmation_text).toBe((await b.json()).confirmation_text);
    expect(fixture.bookingCalls()).toBe(1);
  });

  it('a repeat submit after booking returns the stored confirmation without booking again', async () => {
    const { post, fixture } = setup();
    await post({ ...OPEN, selections: PICKS });
    const again = await post({ ...OPEN, selections: PICKS });
    expect((await again.json()).status).toBe('confirmed');
    expect(fixture.bookingCalls()).toBe(1);
  });

  it('does not book for an already-submitted case', async () => {
    const { post, fixture } = setup();
    const res = await post({ case_id: 'SCHED-1235', token: 'demo-submitted', selections: PICKS });
    expect((await res.json()).status).toBe('confirmed');
    expect(fixture.bookingCalls()).toBe(0);
  });

  it.each([
    ['missing member', PICKS.slice(0, 2)],
    ['extra', [...PICKS, { panelist_id: 'pan-erin', slot_id: 'slot-e4' }]],
    ['mismatched slot', [PICKS[0], PICKS[1], { panelist_id: 'pan-john', slot_id: 'slot-e1' }]],
    ['overlapping', [{ panelist_id: 'pan-erin', slot_id: 'slot-e4' }, { panelist_id: 'pan-sarah', slot_id: 'slot-s4' }, PICKS[2]]],
    ['not an array', 'x'],
  ])('rejects %s with 400', async (_label, selections) => {
    const { post, fixture } = setup();
    expect((await post({ ...OPEN, selections })).status).toBe(400);
    expect(fixture.bookingCalls()).toBe(0);
  });

  it('rejects a non-JSON body with 400', async () => {
    const { post } = setup();
    expect((await post('not json')).status).toBe(400);
  });

  it.each([
    ['wrong token', { case_id: 'SCHED-1234', token: 'wrong' }],
    ['missing token', { case_id: 'SCHED-1234' }],
    ['malformed case', { case_id: '', token: 'demo-open' }],
  ])('returns 404 for %s', async (_label, ids) => {
    const { post, fixture } = setup();
    const res = await post({ ...ids, selections: PICKS });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    expect(fixture.bookingCalls()).toBe(0);
  });

  it('does not let a wrong token piggyback on an in-flight booking', async () => {
    const { post } = setup();
    const [ok, bad] = await Promise.all([post({ ...OPEN, selections: PICKS }), post({ case_id: 'SCHED-1234', token: 'wrong', selections: PICKS })]);
    expect(ok.status).toBe(200);
    expect(bad.status).toBe(404);
  });

  it('returns 409 for an expired case', async () => {
    const { post } = setup();
    expect((await post({ case_id: 'SCHED-1236', token: 'demo-expired', selections: PICKS })).status).toBe(409);
  });

  it('slot-taken: first submit is slot_unavailable for the Sarah pick, the next succeeds', async () => {
    const { post, get } = setup();
    const ids = { case_id: 'SCHED-1239', token: 'demo-slot-taken' };
    const first = await (await post({ ...ids, selections: PICKS })).json();
    expect(first).toEqual({ status: 'slot_unavailable', unavailable_slot_ids: ['slot-s3'] });
    const lookup = await (await get('?case=SCHED-1239&token=demo-slot-taken')).json();
    expect(lookup.panel[1].slots.map((s: { slot_id: string }) => s.slot_id)).not.toContain('slot-s3');
    const second = await (await post({ ...ids, selections: [PICKS[0], { panelist_id: 'pan-sarah', slot_id: 'slot-s2' }, PICKS[2]] })).json();
    expect(second.status).toBe('confirmed');
  });

  it('booking failure → 502 (token redacted in logs), retry succeeds', async () => {
    const { post, logs } = setup();
    const ids = { case_id: 'SCHED-1238', token: 'demo-booking-fails' };
    expect((await post({ ...ids, selections: PICKS })).status).toBe(502);
    expect(logs.join('\n')).not.toContain('demo-booking-fails');
    expect((await post({ ...ids, selections: PICKS })).status).toBe(200);
  });

  it('times out slow bookings with 504', async () => {
    const slow: CaseSource = {
      lookup: createFixtureSource({ lookupLatencyMs: 0 }).lookup,
      book: () => new Promise(() => {}),
    };
    const app = createApp({ source: slow, timeoutMs: 30, logger: { info() {}, error() {} }, audit: () => {} });
    const res = await app.request('/api/public/selection', { method: 'POST', body: JSON.stringify({ ...OPEN, selections: PICKS }), headers: { 'content-type': 'application/json' } });
    expect(res.status).toBe(504);
  });

  it('rejects a malformed booking response with 502', async () => {
    const fixture = createFixtureSource({ lookupLatencyMs: 0 });
    const bad: CaseSource = { lookup: fixture.lookup, book: vi.fn(async () => ({ status: 'weird' })) };
    const app = createApp({ source: bad, logger: { info() {}, error() {} }, audit: () => {} });
    const res = await app.request('/api/public/selection', { method: 'POST', body: JSON.stringify({ ...OPEN, selections: PICKS }), headers: { 'content-type': 'application/json' } });
    expect(res.status).toBe(502);
  });
});

describe('config', () => {
  it('defaults to slots and refuses fixture mode in production', () => {
    expect(loadConfig({}).caseSource).toBe('slots');
    expect(loadConfig({ CASE_SOURCE: 'fixture' }).caseSource).toBe('fixture');
    expect(() => loadConfig({ CASE_SOURCE: 'fixture', NODE_ENV: 'production' })).toThrow(/not allowed/);
    expect(() => loadConfig({ CASE_SOURCE: 'bogus' })).toThrow();
  });
});
