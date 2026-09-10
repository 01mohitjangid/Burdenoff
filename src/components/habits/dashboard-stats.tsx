import { CheckCircle2Icon, FlameIcon, ListChecksIcon, PercentIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { HabitSummary } from '@/lib/api-contract';

interface Props {
  habits: HabitSummary[];
}

interface Tile {
  label: string;
  value: string;
  suffix?: string;
  Icon: LucideIcon;
}

/**
 * The four numbers across the top of the dashboard.
 *
 * Every figure is derived from the summaries the page already loaded, so this
 * costs no extra query. The window length is read off the data rather than
 * hard-coded, so it stays right if `recentDays` ever returns a different count.
 */
export function DashboardStats({ habits }: Props) {
  const doneToday = habits.filter((habit) => habit.checkedInToday).length;
  const bestStreak = Math.max(0, ...habits.map((habit) => habit.longestStreak));

  const windowLength = habits[0]?.recentDays.length ?? 0;
  const possible = habits.length * windowLength;
  const checked = habits.reduce(
    (total, habit) => total + habit.recentDays.filter((day) => day.done).length,
    0
  );
  // Guard the empty case: a user with no habits would otherwise divide by zero.
  const rate = possible === 0 ? 0 : Math.round((checked / possible) * 100);

  const tiles: Tile[] = [
    { label: 'Habits', value: String(habits.length), Icon: ListChecksIcon },
    {
      label: 'Done today',
      value: String(doneToday),
      suffix: `of ${habits.length}`,
      Icon: CheckCircle2Icon,
    },
    {
      label: 'Best streak',
      value: String(bestStreak),
      suffix: bestStreak === 1 ? 'day' : 'days',
      Icon: FlameIcon,
    },
    {
      label: `Last ${windowLength} days`,
      value: `${rate}`,
      suffix: '%',
      Icon: PercentIcon,
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <tile.Icon className="text-muted-foreground size-4 shrink-0" />
            <dt className="text-muted-foreground truncate text-xs font-medium tracking-wide uppercase">
              {tile.label}
            </dt>
          </div>
          <dd className="mt-2 text-2xl font-semibold tabular-nums">
            {tile.value}
            {tile.suffix ? (
              <span className="text-muted-foreground ml-1 text-sm font-normal">
                {tile.suffix}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
