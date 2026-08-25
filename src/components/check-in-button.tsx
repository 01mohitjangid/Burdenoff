'use client';

import { CheckIcon, CircleCheckBigIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { messageFor } from '@/client/api-client';
import { checkInToday } from '@/client/habits.api';
import { BusyButton } from './busy-button';
import { ErrorBanner } from './error-banner';

interface Props {
  habitId: string;
  habitName: string;
  checkedInToday: boolean;
  size?: 'default' | 'lg';
}

/**
 * The one-click "done today" button.
 *
 * It sends no date at all. Today is whatever the server says it is, so a user
 * cannot check in for tomorrow by changing their laptop's clock.
 */
export function CheckInButton({
  habitId,
  habitName,
  checkedInToday,
  size = 'default',
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  // `router.refresh()` returns void, so without a transition the button would
  // go back to idle before the refreshed streak had arrived, and a second click
  // would earn a duplicate error on the app's main action.
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState('');

  async function onCheckIn() {
    setSaving(true);
    setError('');

    try {
      const result = await checkInToday(habitId);
      toast.success(`${habitName} done for ${result.checkIn.localDay}`, {
        description: `${result.habit.currentStreak} day streak.`,
      });
      // The server recomputed the streaks; re-render from it rather than
      // guessing at the new numbers here.
      startTransition(() => router.refresh());
    } catch (thrown) {
      setError(messageFor(thrown));
    } finally {
      setSaving(false);
    }
  }

  if (checkedInToday) {
    return (
      <div className="text-success bg-success-muted inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium">
        <CircleCheckBigIcon className="size-4" />
        Done today
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <BusyButton
        size={size}
        onClick={onCheckIn}
        busy={saving || refreshing}
        busyLabel="Saving…"
      >
        <CheckIcon className="size-4" />
        Check in for today
      </BusyButton>
      <ErrorBanner message={error} />
    </div>
  );
}
