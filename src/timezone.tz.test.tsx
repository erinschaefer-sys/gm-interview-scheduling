// @vitest-environment jsdom
// Runs under TZ=America/Los_Angeles (npm run test:tz). The candidate was
// emailed Eastern times; a Pacific laptop must still show them unchanged.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { SchedulePage } from './pages/SchedulePage';
import { CONFIRMATION, LINK, OPEN_CASE } from './test/fixtures';
import { formatDateShort, formatTimeRange, timeZoneLabel } from '../shared/time';
import * as api from './api/schedule-api';

vi.mock('./api/schedule-api', () => ({ fetchCase: vi.fn(), submitSelections: vi.fn() }));
afterEach(cleanup);

describe('times in the case timezone on a Pacific machine', () => {
  it('is really running in Pacific time', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Los_Angeles');
    expect(new Date('2026-10-28T12:00:00Z').getTimezoneOffset()).toBe(420);
  });

  it('formats without shifting', () => {
    expect(formatDateShort('2026-10-27')).toBe('Tue, Oct 27');
    expect(formatTimeRange('09:00', '09:45')).toBe('9:00 – 9:45 AM');
    expect(timeZoneLabel('America/Detroit', '2026-10-27')).toBe('Eastern Time');
  });

  it('renders the selection page in Eastern', async () => {
    vi.mocked(api.fetchCase).mockResolvedValue({ kind: 'ok', data: OPEN_CASE });
    render(<SchedulePage search={LINK} />);
    await screen.findByRole('heading', { name: 'Choose your interview times' });
    expect(screen.getByText(/All times are Eastern Time/)).toBeInTheDocument();
    const first = within(screen.getByRole('radiogroup', { name: 'Erin Schaefer' })).getAllByRole('radio')[0];
    expect(first).toHaveTextContent('Tue, Oct 27');
    expect(first).toHaveTextContent('10:00 – 10:45 AM');
  });

  it('renders the confirmation in Eastern', async () => {
    vi.mocked(api.fetchCase).mockResolvedValue({ kind: 'ok', data: { ...OPEN_CASE, status: 'submitted', confirmation: CONFIRMATION } });
    render(<SchedulePage search={LINK} />);
    await screen.findByRole('heading', { name: 'Your interviews are booked' });
    expect(screen.getAllByText('Wednesday, October 28, 2026')).toHaveLength(3);
    expect(screen.getByText('9:00 – 9:45 AM')).toBeInTheDocument();
    expect(screen.getByText(/All times are Eastern Time/)).toBeInTheDocument();
  });
});
