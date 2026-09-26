import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CaseView, Confirmation } from '../../shared/types';
import {
  findConflicts,
  findSlot,
  missingPanelists,
  slotKey,
  toSelectionList,
  type SelectionMap,
} from '../../shared/schedule';
import { isValidCaseId, isValidToken } from '../../shared/validate';
import { formatDateShort, formatTimeRange } from '../../shared/time';
import { fetchCase, submitSelections, type LoadResult } from '../api/schedule-api';
import { firstName, joinNames } from '../copy';

export type Phase =
  | { name: 'loading' }
  | { name: 'invalid' }
  | { name: 'open' }
  | { name: 'confirmed'; confirmation: Confirmation }
  | { name: 'expired' }
  | { name: 'error'; retry: 'load' | 'submit' };

export interface Announcement {
  text: string;
  /** Bumped so repeating the same sentence is still announced. */
  id: number;
}

export function readLinkParams(search: string): { caseId: string; token: string } | null {
  const params = new URLSearchParams(search);
  const caseId = params.get('case');
  const token = params.get('token');
  return isValidCaseId(caseId) && isValidToken(token) ? { caseId, token } : null;
}

export function useSchedule(search: string) {
  const link = useMemo(() => readLinkParams(search), [search]);
  const [phase, setPhase] = useState<Phase>(link ? { name: 'loading' } : { name: 'invalid' });
  const [caseView, setCaseView] = useState<CaseView | null>(null);
  const [selections, setSelections] = useState<SelectionMap>({});
  const [taken, setTaken] = useState<Set<string>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [polite, setPolite] = useState<Announcement>({ text: '', id: 0 });
  const [assertive, setAssertive] = useState<Announcement>({ text: '', id: 0 });
  const submittingRef = useRef(false);
  const initialLoadStarted = useRef(false);

  const announce = useCallback((text: string, urgent = false) => {
    (urgent ? setAssertive : setPolite)((prev) => ({ text, id: prev.id + 1 }));
  }, []);

  const panel = useMemo(() => caseView?.panel ?? [], [caseView]);
  const conflicts = useMemo(() => findConflicts(panel, selections), [panel, selections]);
  const missing = useMemo(() => missingPanelists(panel, selections), [panel, selections]);
  const complete = panel.length > 0 && missing.length === 0;

  /** Applies a lookup result. Returns the case when it's open, so callers can continue. */
  const applyLookup = useCallback((result: LoadResult, retry: 'load' | 'submit'): CaseView | null => {
    if (result.kind === 'not_found') { setPhase({ name: 'invalid' }); return null; }
    if (result.kind === 'error') {
      setPhase({ name: 'error', retry });
      announce('Something went wrong. Please try again.', true);
      return null;
    }
    const view = result.data;
    setCaseView(view);
    switch (view.status) {
      case 'open':
        // A panel member with no times means no complete schedule is possible.
        if (view.panel.length === 0 || view.panel.some((p) => p.slots.length === 0)) {
          setPhase({ name: 'expired' });
          return null;
        }
        return view;
      case 'submitted':
        if (view.confirmation) {
          setPhase({ name: 'confirmed', confirmation: view.confirmation });
          announce('Your interviews are confirmed.');
          return null;
        }
        setPhase({ name: 'error', retry });
        return null;
      case 'expired':
        setPhase({ name: 'expired' });
        return null;
      default:
        // Never assume open: an unknown status is an error.
        setPhase({ name: 'error', retry });
        return null;
    }
  }, [announce]);

  const load = useCallback(async () => {
    if (!link) return;
    setPhase({ name: 'loading' });
    const view = applyLookup(await fetchCase(link.caseId, link.token), 'load');
    if (view) setPhase({ name: 'open' });
  }, [link, applyLookup]);

  useEffect(() => {
    // Missing or malformed link: invalid state, and no API call. The ref keeps
    // React StrictMode's dev double-mount from issuing two lookups.
    if (!link || initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    void load();
  }, [link, load]);

  const select = useCallback((panelistId: string, slotId: string) => {
    if (submittingRef.current || !caseView) return;
    const key = slotKey(panelistId, slotId);
    if (conflicts.has(key) || taken.has(key)) return;
    if (selections[panelistId] === slotId) return;

    const next = { ...selections, [panelistId]: slotId };
    setSelections(next);
    setNotice(null);

    const panelist = caseView.panel.find((p) => p.panelist_id === panelistId);
    const slot = findSlot(caseView.panel, panelistId, slotId);
    const nextConflicts = findConflicts(caseView.panel, next);
    const newlyBlocked = [...nextConflicts.keys()].filter((k) => !conflicts.has(k)).length;
    const done = caseView.panel.length - missingPanelists(caseView.panel, next).length;
    const parts = [
      `Selected ${slot ? `${formatDateShort(slot.date)}, ${formatTimeRange(slot.start, slot.end)}` : 'a time'} with ${panelist?.name ?? 'this interviewer'}.`,
      `${done} of ${caseView.panel.length} interviews selected.`,
    ];
    if (newlyBlocked > 0) {
      parts.push(`${newlyBlocked} ${newlyBlocked === 1 ? 'time is' : 'times are'} now unavailable because ${newlyBlocked === 1 ? 'it overlaps' : 'they overlap'} with this interview.`);
    }
    announce(parts.join(' '));
  }, [announce, caseView, conflicts, selections, taken]);

  const book = useCallback(async (view: CaseView, picks: SelectionMap) => {
    if (!link) return;
    const result = await submitSelections({
      case_id: link.caseId,
      token: link.token,
      selections: toSelectionList(view.panel, picks),
    });

    if (result.kind === 'booked' && result.result.status === 'confirmed') {
      setPhase({ name: 'confirmed', confirmation: result.result });
      announce('Your interviews are confirmed.');
    } else if (result.kind === 'booked' && result.result.status === 'slot_unavailable') {
      const gone = new Set<string>(result.result.unavailable_slot_ids);
      const affected = view.panel.filter((p) => picks[p.panelist_id] && gone.has(picks[p.panelist_id]));
      setTaken((prev) => {
        const next = new Set(prev);
        for (const p of affected) next.add(slotKey(p.panelist_id, picks[p.panelist_id]));
        return next;
      });
      setSelections((prev) => {
        const next = { ...prev };
        for (const p of affected) delete next[p.panelist_id];
        return next;
      });
      const names = affected.length > 0 ? joinNames(affected.map((p) => p.name)) : 'your interview panel';
      const message = affected.length > 1
        ? `Some of the times you picked were just taken. Please choose other times with ${names}.`
        : `One of the times you picked was just taken. Please choose another time with ${names}.`;
      setNotice(message);
      setPhase({ name: 'open' });
      announce(message, true);
    } else if (result.kind === 'not_found') {
      setPhase({ name: 'invalid' });
    } else if (result.kind === 'expired') {
      setPhase({ name: 'expired' });
    } else {
      setPhase({ name: 'error', retry: 'submit' });
      announce("We couldn't confirm your interviews. Please try again.", true);
    }
  }, [announce, link]);

  const submit = useCallback(async () => {
    if (submittingRef.current || !caseView || !complete) return;
    submittingRef.current = true;
    setSubmitting(true);
    setNotice(null);
    announce('Submitting your interview times.');
    try {
      await book(caseView, selections);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [announce, book, caseView, complete, selections]);

  const retry = useCallback(async () => {
    if (phase.name !== 'error' || !link) return;
    if (phase.retry === 'load') { await load(); return; }

    // The failed booking may have gone through: re-check status before resubmitting.
    submittingRef.current = true;
    setSubmitting(true);
    setPhase({ name: 'open' });
    announce('Checking your interview times.');
    try {
      const view = applyLookup(await fetchCase(link.caseId, link.token), 'submit');
      if (!view) return;
      // Keep only picks that still exist on the refreshed case.
      const kept: SelectionMap = {};
      for (const p of view.panel) {
        const id = selections[p.panelist_id];
        if (id && p.slots.some((s) => s.slot_id === id)) kept[p.panelist_id] = id;
      }
      setSelections(kept);
      if (missingPanelists(view.panel, kept).length === 0) {
        announce('Submitting your interview times.');
        await book(view, kept);
      } else {
        const names = joinNames(missingPanelists(view.panel, kept).map((p) => p.name));
        const message = `Some times changed. Please choose a time with ${names}.`;
        setNotice(message);
        announce(message, true);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [announce, applyLookup, book, link, load, phase, selections]);

  return {
    phase,
    caseView,
    selections,
    conflicts,
    taken,
    missing,
    complete,
    submitting,
    notice,
    polite,
    assertive,
    select,
    submit,
    retry,
    candidateFirstName: caseView ? firstName(caseView.candidate_name) : '',
  };
}
