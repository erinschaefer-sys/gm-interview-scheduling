import type { Announcement } from '../hooks/useSchedule';

/** Screen-reader announcements. Always mounted so updates are spoken. */
export function LiveRegions({ polite, assertive }: { polite: Announcement; assertive: Announcement }) {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="live-polite">
        <span key={polite.id}>{polite.text}</span>
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true" data-testid="live-assertive">
        <span key={assertive.id}>{assertive.text}</span>
      </div>
    </>
  );
}
