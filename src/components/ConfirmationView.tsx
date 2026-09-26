import { useRef, useState } from 'react';
import type { Confirmation } from '../../shared/types';
import { sortChronological } from '../../shared/schedule';
import { formatDateLong, formatTimeRange, timeZoneLabel } from '../../shared/time';
import { Button } from './ds/Button';
import { Card } from './ds/Card';
import { CheckCircleIcon, CheckIcon } from './ds/Icons';

interface ConfirmationViewProps {
  confirmation: Confirmation;
  candidateFirstName: string;
  timeZone: string;
}

export function ConfirmationView({ confirmation, candidateFirstName, timeZone }: ConfirmationViewProps) {
  const sessions = sortChronological(confirmation.sessions);
  const zone = timeZoneLabel(timeZone, sessions[0]?.date);

  return (
    <div className="mx-auto max-w-2xl py-4 sm:py-8">
      <CheckCircleIcon className="size-12" />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Your interviews are booked</h1>
      <p className="mt-3 text-base text-muted-foreground">
        {candidateFirstName ? `Thanks, ${candidateFirstName}. ` : ''}
        Calendar invitations for each interview are on their way to your email.
      </p>
      <p className="mt-6 text-sm font-semibold">All times are {zone}</p>

      <ol className="mt-3 flex flex-col gap-3">
        {sessions.map((s) => (
          <li key={`${s.panelist_id}-${s.slot_id}`}>
            <Card className="p-4">
              <p className="font-semibold">{s.name}</p>
              <p className="mt-1 text-foreground">{formatDateLong(s.date)}</p>
              <p className="text-muted-foreground">{formatTimeRange(s.start, s.end)}</p>
            </Card>
          </li>
        ))}
      </ol>

      <ReferenceText text={confirmation.confirmation_text} />
    </div>
  );
}

/** Operator fallback (brief §7): selectable text + Copy, quiet and secondary. */
function ReferenceText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API blocked: select the text so Cmd/Ctrl+C still works.
      const node = textRef.current;
      const selection = window.getSelection();
      if (node && selection) {
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  return (
    <section aria-labelledby="reference-label" className="mt-10 border-t border-muted-border pt-5">
      <h2 id="reference-label" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reference</h2>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
        <p ref={textRef} className="min-w-0 flex-1 select-all break-words font-mono text-xs leading-relaxed text-muted-foreground" data-testid="confirmation-text">
          {text}
        </p>
        <Button variant="secondary" size="sm" onClick={copy} className="self-start">
          {copied ? <><CheckIcon className="size-3.5" /> Copied</> : 'Copy'}
        </Button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{copied ? 'Reference copied to clipboard' : ''}</p>
    </section>
  );
}
