import type { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  days: number;
  Icon: LucideIcon;
  tone?: 'primary' | 'muted';
}

/** One streak number with its label, e.g. "Current 3 days". */
export function StreakBadge({ label, days, Icon, tone = 'muted' }: Props) {
  const lit = tone === 'primary' && days > 0;

  return (
    <div className="flex items-center gap-3">
      <div
        className={
          lit
            ? 'bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg'
            : 'bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg'
        }
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        <p className="text-xl font-semibold tabular-nums">
          {days}
          <span className="text-muted-foreground ml-1 text-sm font-normal">
            {days === 1 ? 'day' : 'days'}
          </span>
        </p>
      </div>
    </div>
  );
}
