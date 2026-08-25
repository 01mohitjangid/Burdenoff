import { ArrowLeftIcon, CalendarCheckIcon, FlameIcon, TrophyIcon } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { AccountBar } from '@/components/account-bar';
import { BackfillForm } from '@/components/backfill-form';
import { CheckInButton } from '@/components/check-in-button';
import { CheckInHistory } from '@/components/check-in-history';
import { HabitActions } from '@/components/habit-actions';
import { StreakBadge } from '@/components/streak-badge';
import { Card, CardContent } from '@/components/ui/card';
import { findHabitDetail } from '@/server/services/habit.service';
import { requireUserOrRedirect } from '@/server/session';

export const dynamic = 'force-dynamic';

/**
 * `generateMetadata` and the page body run on the same request, and Next only
 * de-duplicates native `fetch`, not arbitrary async functions. Without these
 * wrappers every habit page view would run the session lookup, the habit lookup
 * and the whole check-in history twice.
 *
 * The two are a pair, and that is easy to miss. `cache` keys object arguments by
 * reference identity, so `loadDetail(user, id)` only hits its cache because
 * `loadUser()` handed back the very same `user` object both times. Calling
 * `requireUserOrRedirect()` directly here would look like a harmless
 * simplification and would silently double the expensive history query again,
 * with every test still green.
 */
const loadUser = cache(requireUserOrRedirect);
const loadDetail = cache(findHabitDetail);

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const user = await loadUser();
  const { id } = await params;
  const detail = await loadDetail(user, id);

  return { title: detail ? `${detail.habit.name} · Habit Tracker` : 'Habit Tracker' };
}

export default async function HabitPage({ params }: Props) {
  const user = await loadUser();
  const { id } = await params;

  // `findHabitDetail` returns null for a habit that does not exist AND for one
  // belonging to somebody else, which is exactly the same answer this page
  // should give for both.
  const detail = await loadDetail(user, id);
  if (!detail) notFound();

  const { habit, checkIns, today } = detail;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeftIcon className="size-4" />
          All habits
        </Link>
        <AccountBar user={user} />
      </div>

      <header className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">
          {habit.name}
        </h1>
        {habit.description ? (
          <p className="text-muted-foreground mt-1 break-words">{habit.description}</p>
        ) : null}
        <p className="text-muted-foreground mt-2 text-sm">
          Started <span className="tabular-nums">{habit.startedOn}</span>. Today is{' '}
          <span className="tabular-nums">{today}</span> in {user.timeZone}.
        </p>
      </header>

      <Card className="mt-6">
        <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <StreakBadge
            label="Current streak"
            days={habit.currentStreak}
            Icon={FlameIcon}
            tone="primary"
          />
          <StreakBadge
            label="Longest streak"
            days={habit.longestStreak}
            Icon={TrophyIcon}
          />
          <StreakBadge
            label="Days recorded"
            days={checkIns.length}
            Icon={CalendarCheckIcon}
          />
        </CardContent>
      </Card>

      <div className="mt-6">
        <CheckInButton
          habitId={habit.id}
          habitName={habit.name}
          checkedInToday={habit.checkedInToday}
          size="lg"
        />
      </div>

      <div className="mt-6">
        <BackfillForm habitId={habit.id} startedOn={habit.startedOn} today={today} />
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-semibold">History</h2>
        <CheckInHistory checkIns={checkIns} today={today} />
      </section>

      <div className="mt-6">
        <HabitActions habit={habit} />
      </div>
    </main>
  );
}
