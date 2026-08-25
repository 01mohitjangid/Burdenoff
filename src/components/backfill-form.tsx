'use client';

import { CalendarPlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { fieldsFor, messageFor } from '@/client/api-client';
import { backfillCheckIn } from '@/client/habits.api';
import type { FieldErrors } from '@/lib/api-contract';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BusyButton } from './busy-button';
import { ErrorBanner } from './error-banner';
import { FieldError } from './field-error';

interface Props {
  habitId: string;
  /** The earliest day this habit can be checked in for, from the server. */
  startedOn: string;
  /** The caller's today, as the server computed it. */
  today: string;
}

/**
 * Records a check-in for a day the user missed.
 *
 * `min` and `max` come from the server, not from the browser's clock. They only
 * make the impossible choices unpickable — the same two rules are enforced
 * again on the way in, because a date input is trivial to bypass.
 */
export function BackfillForm({ habitId, startedOn, today }: Props) {
  const router = useRouter();
  const [localDay, setLocalDay] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [fields, setFields] = useState<FieldErrors>({});

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    // Checked here as well as by the input's `required`, because native form
    // validation is one `noValidate` away from being skipped entirely.
    if (!localDay) {
      setFields({ localDay: ['Pick a day to record.'] });
      return;
    }

    setSaving(true);
    setError('');
    setFields({});

    try {
      const result = await backfillCheckIn(habitId, localDay);
      toast.success(`Recorded ${result.checkIn.localDay}`, {
        description: `${result.habit.currentStreak} day streak.`,
      });
      setLocalDay('');
      startTransition(() => router.refresh());
    } catch (thrown) {
      setError(messageFor(thrown));
      setFields(fieldsFor(thrown));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backfill a missed day</CardTitle>
        <CardDescription>
          Any day from {startedOn} to {today}, in your own time zone.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="backfill-day">Day to record</Label>
              <Input
                id="backfill-day"
                type="date"
                value={localDay}
                onChange={(event) => setLocalDay(event.target.value)}
                min={startedOn}
                max={today}
                required
                aria-invalid={Boolean(fields.localDay?.length)}
                aria-describedby="backfill-day-error"
              />
              <FieldError fields={fields} name="localDay" id="backfill-day-error" />
            </div>

            <BusyButton
              variant="secondary"
              busy={saving || refreshing}
              busyLabel="Saving…"
            >
              <CalendarPlusIcon className="size-4" />
              Record it
            </BusyButton>
          </div>

          <ErrorBanner message={error} />
        </form>
      </CardContent>
    </Card>
  );
}
