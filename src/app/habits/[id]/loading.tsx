import { PageShell } from '@/components/page-shell';
import { StreakBadgeSkeleton } from '@/components/streak-badge-skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// The history list is the slow part of this page, so it gets the most rows.
const HISTORY_ROWS = ['a', 'b', 'c', 'd', 'e'];

/**
 * Shown while `findHabitDetail` runs, which reads the habit and its whole
 * check-in history.
 *
 * The two-column split below mirrors the real page exactly, including the point
 * at which it collapses back to one column.
 */
export default function HabitLoading() {
  return (
    <PageShell>
      <div role="status" aria-busy="true">
        <span className="sr-only">Loading this habit…</span>

        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-5 w-24" />
          <div className="flex shrink-0 items-center gap-1">
            <Skeleton className="size-9" />
            <Skeleton className="size-9" />
          </div>
        </div>

        <header className="mt-6 flex max-w-3xl flex-col gap-2">
          <Skeleton className="h-8 w-64 sm:h-9" />
          <Skeleton className="h-5 w-full max-w-md" />
          <Skeleton className="h-4 w-72" />
        </header>

        <Card className="mt-6">
          <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <StreakBadgeSkeleton />
            <StreakBadgeSkeleton />
            <StreakBadgeSkeleton />
          </CardContent>
        </Card>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-10 w-40" />

            <Card>
              <CardHeader className="gap-2">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-9 w-full" />
                </div>
                <Skeleton className="h-9 w-28" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-9 w-full" />
                </div>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Skeleton className="h-9 w-36" />
                  <Skeleton className="h-9 w-32" />
                </div>
              </CardContent>
            </Card>
          </div>

          <section>
            <Skeleton className="mb-3 h-5 w-20" />
            <div className="divide-border divide-y rounded-lg border">
              {HISTORY_ROWS.map((key) => (
                <div key={key} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="size-4 shrink-0 rounded-full" />
                  <Skeleton className="h-5 w-28" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
