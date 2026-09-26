import { useId } from 'react';
import { Button } from './ds/Button';

interface SubmitControlProps {
  progress: string;
  helper: string | null;
  submitting: boolean;
  onSubmit: () => void;
  showProgress?: boolean;
}

export function SubmitControl({ progress, helper, submitting, onSubmit, showProgress = true }: SubmitControlProps) {
  const helperId = useId();
  return (
    <div className="flex flex-col gap-2">
      {showProgress && <p className="text-sm font-semibold">{progress}</p>}
      <Button
        className="w-full"
        inactive={Boolean(helper)}
        pending={submitting}
        aria-describedby={helper ? helperId : undefined}
        onClick={onSubmit}
      >
        {submitting ? 'Booking your interviews…' : 'Confirm my interviews'}
      </Button>
      {helper && !submitting && <p id={helperId} className="text-sm text-muted-foreground">{helper}</p>}
    </div>
  );
}
