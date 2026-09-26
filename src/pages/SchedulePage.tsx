import { useEffect, useRef } from 'react';
import { timeZoneLabel } from '../../shared/time';
import { introCopy, missingHelper } from '../copy';
import { useSchedule } from '../hooks/useSchedule';
import { ConfirmationView } from '../components/ConfirmationView';
import { Button } from '../components/ds/Button';
import { Card } from '../components/ds/Card';
import { ClockIcon } from '../components/ds/Icons';
import { Header } from '../components/Header';
import { LiveRegions } from '../components/LiveRegions';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { PanelSection } from '../components/PanelSection';
import { ScheduleSummary, progressText } from '../components/ScheduleSummary';
import { StatusMessage } from '../components/StatusMessage';
import { SubmitControl } from '../components/SubmitControl';

export function SchedulePage({ search }: { search: string }) {
  const s = useSchedule(search);
  const noticeRef = useRef<HTMLDivElement>(null);

  // Move focus to the "slot taken" notice so keyboard users land next to it.
  useEffect(() => {
    if (s.notice) noticeRef.current?.focus();
  }, [s.notice]);

  const isOpen = s.phase.name === 'open' && s.caseView;

  return (
    <div className="min-h-dvh bg-app-background">
      <Header />
      <main className={`mx-auto max-w-5xl px-4 pt-8 ${isOpen ? 'pb-44 lg:pb-16' : 'pb-16'}`}>
        <Body s={s} noticeRef={noticeRef} />
      </main>
      <LiveRegions polite={s.polite} assertive={s.assertive} />
    </div>
  );
}

function Body({ s, noticeRef }: { s: ReturnType<typeof useSchedule>; noticeRef: React.RefObject<HTMLDivElement | null> }) {
  switch (s.phase.name) {
    case 'loading':
      return <LoadingSkeleton />;
    case 'invalid':
      return <StatusMessage title="This link isn't valid." />;
    case 'expired':
      return (
        <StatusMessage title="These times are no longer available.">
          <p>Someone from GM will follow up with you about new interview times.</p>
        </StatusMessage>
      );
    case 'error':
      return (
        <StatusMessage
          title={s.phase.retry === 'submit' ? "We couldn't confirm your interviews." : "We couldn't load your interview times."}
          action={<Button onClick={() => void s.retry()}>Try again</Button>}
        >
          <p>Something went wrong on our end. Please try again.</p>
        </StatusMessage>
      );
    case 'confirmed':
      return (
        <ConfirmationView
          confirmation={s.phase.confirmation}
          candidateFirstName={s.candidateFirstName}
          timeZone={s.caseView?.timezone ?? 'America/Detroit'}
        />
      );
    case 'open':
      return s.caseView ? <OpenView s={s} noticeRef={noticeRef} /> : <LoadingSkeleton />;
  }
}

function OpenView({ s, noticeRef }: { s: ReturnType<typeof useSchedule>; noticeRef: React.RefObject<HTMLDivElement | null> }) {
  const view = s.caseView!;
  const zone = timeZoneLabel(view.timezone, view.panel[0]?.slots[0]?.date);
  const progress = progressText(view.panel, s.selections);
  const helper = s.complete ? null : missingHelper(s.missing);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Choose your interview times</h1>
      <p className="mt-3 max-w-2xl text-base text-muted-foreground">
        {introCopy(view.candidate_name, view.requisition_title, view.panel)}
      </p>
      <p className="mt-5 inline-flex items-center gap-2 rounded-lg bg-muted-bg px-3 py-2 text-sm font-semibold">
        <ClockIcon />
        All times are {zone}
      </p>

      {s.notice && (
        <div
          ref={noticeRef}
          tabIndex={-1}
          className="mt-6 rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm font-medium text-danger-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          {s.notice}
        </div>
      )}

      <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-10">
        <div className="flex flex-col gap-8">
          {view.panel.map((p) => (
            <PanelSection
              key={p.panelist_id}
              panelist={p}
              selectedSlotId={s.selections[p.panelist_id]}
              conflicts={s.conflicts}
              taken={s.taken}
              locked={s.submitting}
              onSelect={s.select}
            />
          ))}
        </div>

        {/* Desktop: summary + Submit in a sticky side panel. */}
        <aside className="sticky top-6 hidden lg:block">
          <Card>
            <ScheduleSummary panel={view.panel} selections={s.selections} />
            <div className="mt-6">
              <SubmitControl progress={progress} helper={helper} submitting={s.submitting} onSubmit={() => void s.submit()} showProgress={false} />
            </div>
          </Card>
        </aside>

        {/* Phone/tablet: summary inline after the lists… */}
        <Card className="mt-8 lg:hidden">
          <ScheduleSummary panel={view.panel} selections={s.selections} />
        </Card>
      </div>

      {/* …and progress + Submit in a sticky bottom bar. */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-muted-border bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto max-w-5xl">
          <SubmitControl progress={progress} helper={helper} submitting={s.submitting} onSubmit={() => void s.submit()} />
        </div>
      </div>
    </>
  );
}
