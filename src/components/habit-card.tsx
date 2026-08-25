import { ChevronRightIcon, FlameIcon, TrophyIcon } from 'lucide-react';
import Link from 'next/link';
import type { HabitSummary } from '@/lib/api-contract';
import { Card, CardContent } from '@/components/ui/card';
import { CheckInButton } from './check-in-button';
import { StreakBadge } from './streak-badge';

interface Props {
  habit: HabitSummary;
}

export function HabitCard({ habit }: Props) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/habits/${habit.id}`}
              className="group flex items-center gap-1 font-semibold"
            >
              <span className="truncate">{habit.name}</span>
              <ChevronRightIcon className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </Link>
            {habit.description ? (
              <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                {habit.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <StreakBadge
            label="Current"
            days={habit.currentStreak}
            Icon={FlameIcon}
            tone="primary"
          />
          <StreakBadge label="Longest" days={habit.longestStreak} Icon={TrophyIcon} />
        </div>

        <CheckInButton
          habitId={habit.id}
          habitName={habit.name}
          checkedInToday={habit.checkedInToday}
        />
      </CardContent>
    </Card>
  );
}
