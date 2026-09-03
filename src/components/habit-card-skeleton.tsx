import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StreakBadgeSkeleton } from './streak-badge-skeleton';

/** The placeholder for one `HabitCard`: name, two streaks, and its button. */
export function HabitCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full max-w-56" />
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <StreakBadgeSkeleton />
          <StreakBadgeSkeleton />
        </div>

        <Skeleton className="h-9 w-36" />
      </CardContent>
    </Card>
  );
}
