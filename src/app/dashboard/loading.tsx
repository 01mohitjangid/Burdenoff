import { HabitCardSkeleton } from '@/components/habit-card-skeleton';
import { PageShell } from '@/components/page-shell';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// How many placeholder cards to show before the real count is known. Three
// fills the widest grid row without inventing a long list that then shrinks.
const PLACEHOLDERS = ['a', 'b', 'c'];

/**
 * Shown while `listHabits` runs.
 *
 * It reuses `PageShell` rather than re-stating the widths, so the skeleton and
 * the real dashboard occupy exactly the same box and nothing shifts when the
 * data arrives.
 */
export default function DashboardLoading() {
  return (
    <PageShell>
      <div role="status" aria-busy="true">
        <span className="sr-only">Loading your habits…</span>

        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Skeleton className="h-8 w-44 sm:h-9 sm:w-56" />
            <Skeleton className="mt-2 h-4 w-60" />
          </div>
          {/* The theme toggle and the account menu, both 36px icon buttons. */}
          <div className="flex shrink-0 items-center gap-1">
            <Skeleton className="size-9" />
            <Skeleton className="size-9" />
          </div>
        </header>

        <Skeleton className="mt-6 h-6 w-44 rounded-full" />

        <Card className="mt-6">
          <CardHeader className="gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
            <Skeleton className="h-9 w-32" />
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PLACEHOLDERS.map((key) => (
            <HabitCardSkeleton key={key} />
          ))}
        </div>
      </div>
    </PageShell>
  );
}
