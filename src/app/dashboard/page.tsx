import { CalendarDaysIcon } from 'lucide-react';
import { CreateHabitForm } from '@/components/habits/create-habit-form';
import { DashboardStats } from '@/components/habits/dashboard-stats';
import { HabitCard } from '@/components/habits/habit-card';
import { Navbar } from '@/components/layout/navbar';
import { PageShell } from '@/components/layout/page-shell';
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

  return (
    <>
      <Navbar user={user} />

      <PageShell>
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

        {habits.length > 0 ? (
          <div className="mt-6">
            <DashboardStats habits={habits} />
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
    </>
  );
}
