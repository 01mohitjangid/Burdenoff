import type { RecentDay } from '@/lib/api-contract';

interface Props {
  days: RecentDay[];
}

/**
 * A habit's recent days, one square per day, oldest on the left.
 *
 * The label under each square is the day of the month, taken as the last two
 * characters of the local day. That is deliberate: a weekday letter would mean
 * turning a calendar square back into a `Date`, and this component has no time
 * zone to do it in. The number is already correct as a string.
 */
export function WeekStrip({ days }: Props) {
  const doneCount = days.filter((day) => day.done).length;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Last {days.length} days
        </p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {doneCount} of {days.length}
        </p>
      </div>

      <ol className="mt-2 flex gap-1.5">
        {days.map((day, index) => {
          const isToday = index === days.length - 1;
          return (
            <li key={day.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span
                title={`${day.day} — ${day.done ? 'checked in' : 'not checked in'}`}
                className={
                  day.done
                    ? 'bg-primary h-7 w-full rounded-md'
                    : 'bg-muted h-7 w-full rounded-md'
                }
              />
              <span
                className={
                  isToday
                    ? 'text-foreground text-[10px] font-semibold tabular-nums'
                    : 'text-muted-foreground text-[10px] tabular-nums'
                }
              >
                {day.day.slice(-2)}
              </span>
            </li>
          );
        })}
      </ol>

      {/* The squares are decorative to a screen reader; this is the real content. */}
      <p className="sr-only">
        Checked in on {doneCount} of the last {days.length} days.
      </p>
    </div>
  );
}
