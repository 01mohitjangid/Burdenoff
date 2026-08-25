import { CircleCheckBigIcon } from 'lucide-react';
import type { CheckInRecord } from '@/lib/api-contract';
import { Badge } from '@/components/ui/badge';

interface Props {
  checkIns: CheckInRecord[];
  today: string;
}

export function CheckInHistory({ checkIns, today }: Props) {
  if (checkIns.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        Nothing recorded yet.
      </p>
    );
  }

  return (
    <ul className="divide-border divide-y rounded-lg border">
      {checkIns.map((checkIn) => (
        <li
          key={checkIn.id}
          className="flex items-center justify-between gap-3 px-4 py-3"
        >
          <span className="flex items-center gap-3">
            <CircleCheckBigIcon className="text-success size-4 shrink-0" />
            <span className="font-medium tabular-nums">{checkIn.localDay}</span>
          </span>
          {checkIn.localDay === today ? <Badge variant="secondary">Today</Badge> : null}
        </li>
      ))}
    </ul>
  );
}
