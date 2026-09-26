// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SchedulePage } from './SchedulePage';
import { CONFIRMATION, LINK, OPEN_CASE } from '../test/fixtures';
import * as api from '../api/schedule-api';

vi.mock('../api/schedule-api', () => ({ fetchCase: vi.fn(), submitSelections: vi.fn() }));
const fetchCase = vi.mocked(api.fetchCase);
const submitSelections = vi.mocked(api.submitSelections);

const group = (name: string) => screen.getByRole('radiogroup', { name });
const slot = (groupName: string, label: RegExp) => within(group(groupName)).getByRole('radio', { name: label });
// Both the desktop panel and phone bar render a Submit; jsdom ignores CSS, so take the first.
const submitButton = () => screen.getAllByRole('button', { name: /confirm my interviews|booking your interviews/i })[0];

async function openPage(search = LINK) {
  render(<SchedulePage search={search} />);
  await screen.findByRole('heading', { name: 'Choose your interview times' });
}

beforeEach(() => {
  fetchCase.mockResolvedValue({ kind: 'ok', data: structuredClone(OPEN_CASE) });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('link handling', () => {
  it.each(['', '?case=SCHED-1234', '?token=demo-open', '?case=%3Cx%3E&token=demo-open'])('invalid link %s renders invalid state without calling the API', async (search) => {
    render(<SchedulePage search={search} />);
    expect(screen.getByRole('heading', { name: "This link isn't valid." })).toBeInTheDocument();
    expect(fetchCase).not.toHaveBeenCalled();
  });

  it('a 404 renders the invalid state', async () => {
    fetchCase.mockResolvedValue({ kind: 'not_found' });
    render(<SchedulePage search={LINK} />);
    expect(await screen.findByRole('heading', { name: "This link isn't valid." })).toBeInTheDocument();
  });

  it('an unknown status renders the error state', async () => {
    fetchCase.mockResolvedValue({ kind: 'ok', data: { ...OPEN_CASE, status: 'paused' } });
    render(<SchedulePage search={LINK} />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('a panel member with no slots renders expired', async () => {
    fetchCase.mockResolvedValue({ kind: 'ok', data: { ...OPEN_CASE, panel: [...OPEN_CASE.panel.slice(0, 2), { ...OPEN_CASE.panel[2], slots: [] }] } });
    render(<SchedulePage search={LINK} />);
    expect(await screen.findByRole('heading', { name: 'These times are no longer available.' })).toBeInTheDocument();
  });

  it('load error → Try again reloads', async () => {
    fetchCase.mockResolvedValueOnce({ kind: 'error' });
    render(<SchedulePage search={LINK} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Choose your interview times' })).toBeInTheDocument();
    expect(fetchCase).toHaveBeenCalledTimes(2);
  });
});

describe('open state', () => {
  it('greets the candidate, states the zone once, no internal ids', async () => {
    await openPage();
    expect(screen.getByText(/Hi Daniel, thanks for your interest in the Senior Battery Systems Engineer role\. You'll have three 45-minute interviews, one with each member of your interview panel\./)).toBeInTheDocument();
    expect(screen.getAllByText(/All times are Eastern Time/)).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/SCHED-|slot-|pan-|panelist|requisition/i);
  });

  it('one pick per person: a second pick in the same group replaces the first', async () => {
    await openPage();
    const user = userEvent.setup();
    await user.click(slot('Erin Schaefer', /Tue, Oct 27.*10:00 – 10:45 AM/));
    await user.click(slot('Erin Schaefer', /Tue, Oct 27.*2:00 – 2:45 PM/));
    const checked = within(group('Erin Schaefer')).getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveTextContent('2:00 – 2:45 PM');
  });

  it('overlapping slots for other members become unavailable with a reason, and free up again', async () => {
    await openPage();
    const user = userEvent.setup();
    await user.click(slot('Erin Schaefer', /10:00 – 10:45 AM/));
    const s1 = slot('Sarah Teller', /10:30 – 11:15 AM/);
    expect(s1).toHaveAttribute('aria-disabled', 'true');
    expect(s1).toHaveAccessibleDescription('Overlaps your time with Erin');
    await user.click(s1);
    expect(s1).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('live-polite')).toHaveTextContent(/1 time is now unavailable/);

    await user.click(slot('Erin Schaefer', /2:00 – 2:45 PM/));
    expect(s1).not.toHaveAttribute('aria-disabled');
  });

  it('gates Submit with helper text naming who is missing, then books', async () => {
    let resolve!: (v: Awaited<ReturnType<typeof api.submitSelections>>) => void;
    submitSelections.mockReturnValue(new Promise((r) => { resolve = r; }));
    await openPage();
    const user = userEvent.setup();

    expect(submitButton()).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getAllByText('Choose a time with Erin Schaefer, Sarah Teller, and John Doe to continue.')[0]).toBeInTheDocument();

    await user.click(slot('Erin Schaefer', /Wed, Oct 28.*9:00 – 9:45 AM/));
    await user.click(slot('Sarah Teller', /Wed, Oct 28.*10:00 – 10:45 AM/));
    expect(screen.getAllByText('Choose a time with John Doe to continue.')[0]).toBeInTheDocument();
    expect(screen.getAllByText('2 of 3 interviews selected').length).toBeGreaterThan(0);
    await user.click(submitButton());
    expect(submitSelections).not.toHaveBeenCalled();

    await user.click(slot('John Doe', /Wed, Oct 28.*11:00 – 11:45 AM/));
    expect(submitButton()).not.toHaveAttribute('aria-disabled');
    await user.click(submitButton());
    await user.click(submitButton()); // double click
    expect(submitSelections).toHaveBeenCalledTimes(1);
    expect(submitSelections).toHaveBeenCalledWith({
      case_id: 'SCHED-1234', token: 'demo-open',
      selections: [
        { panelist_id: 'pan-erin', slot_id: 'slot-e3' },
        { panelist_id: 'pan-sarah', slot_id: 'slot-s3' },
        { panelist_id: 'pan-john', slot_id: 'slot-j3' },
      ],
    });

    // Submitting: pending button, selections locked.
    expect(submitButton()).toHaveTextContent('Booking your interviews…');
    expect(slot('Erin Schaefer', /2:00 – 2:45 PM/)).toHaveAttribute('aria-disabled', 'true');
    await user.click(slot('Erin Schaefer', /2:00 – 2:45 PM/));
    expect(slot('Erin Schaefer', /9:00 – 9:45 AM/)).toHaveAttribute('aria-checked', 'true');

    resolve({ kind: 'booked', result: CONFIRMATION });
    expect(await screen.findByRole('heading', { name: 'Your interviews are booked' })).toBeInTheDocument();
  });

  it('summary lists picks chronologically, not in panel order', async () => {
    await openPage();
    const user = userEvent.setup();
    await user.click(slot('John Doe', /Tue, Oct 27.*11:00 – 11:45 AM/));
    await user.click(slot('Erin Schaefer', /Tue, Oct 27.*10:00 – 10:45 AM/));
    const summary = screen.getAllByRole('heading', { name: 'Your schedule' })[0].parentElement!;
    const items = within(summary).getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toMatch(/Erin Schaefer/);
    expect(items[1]).toMatch(/John Doe/);
  });

  it('keyboard: arrows move within a group, Space selects, Tab moves between groups', async () => {
    await openPage();
    const user = userEvent.setup();
    await user.tab();
    expect(slot('Erin Schaefer', /10:00 – 10:45 AM/)).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(slot('Erin Schaefer', /2:00 – 2:45 PM/)).toHaveFocus();
    await user.keyboard(' ');
    expect(slot('Erin Schaefer', /2:00 – 2:45 PM/)).toHaveAttribute('aria-checked', 'true');
    await user.tab();
    expect(slot('Sarah Teller', /10:30 – 11:15 AM/)).toHaveFocus();
  });
});

describe('after submit', () => {
  async function fillAndSubmit() {
    await openPage();
    const user = userEvent.setup();
    await user.click(slot('Erin Schaefer', /Wed, Oct 28.*9:00 – 9:45 AM/));
    await user.click(slot('Sarah Teller', /Wed, Oct 28.*10:00 – 10:45 AM/));
    await user.click(slot('John Doe', /Wed, Oct 28.*11:00 – 11:45 AM/));
    await user.click(submitButton());
    return user;
  }

  it('slot taken: clears and marks the taken slot, keeps other picks, resubmits', async () => {
    submitSelections.mockResolvedValueOnce({ kind: 'booked', result: { status: 'slot_unavailable', unavailable_slot_ids: ['slot-s3'] } });
    const user = await fillAndSubmit();
    const message = 'One of the times you picked was just taken. Please choose another time with Sarah Teller.';
    expect(await screen.findByText(message, { selector: 'div[tabindex="-1"]' })).toHaveFocus();
    const s3 = slot('Sarah Teller', /Wed, Oct 28.*10:00 – 10:45 AM/);
    expect(s3).toHaveAttribute('aria-checked', 'false');
    expect(s3).toHaveAttribute('aria-disabled', 'true');
    expect(s3).toHaveAccessibleDescription('No longer available');
    expect(slot('Erin Schaefer', /9:00 – 9:45 AM/)).toHaveAttribute('aria-checked', 'true');
    expect(slot('John Doe', /Wed, Oct 28.*11:00 – 11:45 AM/)).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('live-assertive')).toHaveTextContent(/just taken/);

    submitSelections.mockResolvedValueOnce({ kind: 'booked', result: CONFIRMATION });
    await user.click(slot('Sarah Teller', /Tue, Oct 27.*3:00 – 3:45 PM/));
    await user.click(submitButton());
    expect(await screen.findByRole('heading', { name: 'Your interviews are booked' })).toBeInTheDocument();
  });

  it('submit error → Try again re-checks status first and shows confirmed if the booking went through', async () => {
    submitSelections.mockResolvedValueOnce({ kind: 'error' });
    const user = await fillAndSubmit();
    const tryAgain = await screen.findByRole('button', { name: 'Try again' });
    fetchCase.mockResolvedValueOnce({ kind: 'ok', data: { ...OPEN_CASE, status: 'submitted', confirmation: CONFIRMATION } });
    await user.click(tryAgain);
    expect(await screen.findByRole('heading', { name: 'Your interviews are booked' })).toBeInTheDocument();
    expect(fetchCase).toHaveBeenCalledTimes(2);
    expect(submitSelections).toHaveBeenCalledTimes(1);
  });

  it('submit error → Try again resubmits when the case is still open', async () => {
    submitSelections.mockResolvedValueOnce({ kind: 'error' }).mockResolvedValueOnce({ kind: 'booked', result: CONFIRMATION });
    const user = await fillAndSubmit();
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Your interviews are booked' })).toBeInTheDocument();
    expect(fetchCase).toHaveBeenCalledTimes(2);
    expect(submitSelections).toHaveBeenCalledTimes(2);
  });
});

describe('confirmed state', () => {
  it('already-submitted case shows sessions chronologically, zone once, and a working Copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    fetchCase.mockResolvedValue({ kind: 'ok', data: { ...OPEN_CASE, status: 'submitted', confirmation: CONFIRMATION } });
    render(<SchedulePage search={LINK} />);
    await screen.findByRole('heading', { name: 'Your interviews are booked' });

    const names = screen.getAllByRole('listitem').map((li) => li.querySelector('p')?.textContent);
    expect(names).toEqual(['Erin Schaefer', 'Sarah Teller', 'John Doe']);
    expect(screen.getAllByText(/All times are Eastern Time/)).toHaveLength(1);
    expect(screen.getByTestId('confirmation-text')).toHaveTextContent(CONFIRMATION.confirmation_text);
    expect(screen.queryByRole('button', { name: /confirm my interviews/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(CONFIRMATION.confirmation_text);
    expect(await screen.findByRole('button', { name: /Copied/ })).toBeInTheDocument();
  });
});
