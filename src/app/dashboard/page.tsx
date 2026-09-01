import { CalendarDaysIcon } from 'lucide-react';
import { AccountBar } from '@/components/account-bar';
import { CreateHabitForm } from '@/components/create-habit-form';
import { HabitCard } from '@/components/habit-card';
import { PageShell } from '@/components/page-shell';
import { Badge } from '@/components/ui/badge';
import { listHabits } from '@/server/services/habit.service';
import { requireUserOrRedirect } from '@/server/session';

export const metadata = { title: 'Your habits · Habit Tracker' };

// The dashboard reads the session cookie, so it can never be cached.
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireUserOrRedirect();
  // A server component is already server code, so it calls the service directly
  // rather than making an HTTP request to its own API.
  const { habits, today } = await listHabits(user);

  const doneToday = habits.filter((habit) => habit.checkedInToday).length;

  return (
    <PageShell>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Your habits
          </h1>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
            <CalendarDaysIcon className="size-4 shrink-0" />
            <span className="tabular-nums">{today}</span>
            <span>in</span>
            <span>{user.timeZone}</span>
          </p>
        </div>
        <AccountBar user={user} />
      </header>

      {habits.length > 0 ? (
        <div className="mt-6 flex items-center gap-2">
          <Badge variant={doneToday === habits.length ? 'default' : 'secondary'}>
            {doneToday} of {habits.length} done today
          </Badge>
        </div>
      ) : null}

      <div className="mt-6">
        <CreateHabitForm />
      </div>

      {habits.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">No habits yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Add your first one above, then check in once a day.
          </p>
        </div>
      ) : (
        // A grid rather than a stack: the wide shell is only worth having if the
        // cards use the width instead of each stretching across it.
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {habits.map((habit) => (
            <li key={habit.id}>
              <HabitCard habit={habit} />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
