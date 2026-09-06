import { Skeleton } from '@/components/ui/skeleton';

/**
 * The placeholder for one `StreakBadge`.
 *
 * The sizes here trace that component on purpose — a 36px icon box, a small
 * label, a larger number. If the two drift apart the page visibly jumps when
 * the real data lands, which is the one thing a skeleton exists to prevent.
 */
export function StreakBadgeSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="size-9 shrink-0 rounded-lg" />
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-6 w-20" />
      </div>
    </div>
  );
}
