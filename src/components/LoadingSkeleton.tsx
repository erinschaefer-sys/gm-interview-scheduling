import { Skeleton } from './ds/Skeleton';

/** Mirrors the open layout (headline, intro, zone line, 3 × 5 rows, summary) so nothing shifts. */
export function LoadingSkeleton() {
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">Loading your interview times</p>
      <Skeleton className="h-8 w-80 max-w-full sm:h-9" />
      <Skeleton className="mt-4 h-5 w-full max-w-2xl" />
      <Skeleton className="mt-2 h-5 w-3/4 max-w-xl" />
      <Skeleton className="mt-5 h-9 w-56" />
      <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
        <div className="flex flex-col gap-8">
          {[0, 1, 2].map((g) => (
            <div key={g}>
              <Skeleton className="h-7 w-40" />
              <div className="mt-3 flex flex-col gap-2">
                {[0, 1, 2, 3, 4].map((r) => <Skeleton key={r} className="h-14 w-full rounded-lg" />)}
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="hidden h-56 rounded-xl lg:block" />
      </div>
    </div>
  );
}
