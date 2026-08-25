import { CalendarCheckIcon, FlameIcon, GlobeIcon } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/server/session';

export const dynamic = 'force-dynamic';

const POINTS = [
  {
    Icon: GlobeIcon,
    title: 'Your days, not the server’s',
    body: 'A streak is measured in your own time zone. Two check-ins twenty hours apart may be one day or two, and only your calendar decides.',
  },
  {
    Icon: CalendarCheckIcon,
    title: 'One tap, or fill in a gap',
    body: 'Check in for today without picking a date, or backfill a day you missed. Duplicates for the same day are refused.',
  },
  {
    Icon: FlameIcon,
    title: 'Streaks the server computes',
    body: 'Current and longest streaks arrive already worked out. Backfilling a gap re-counts them properly.',
  },
];

export default async function HomePage() {
  if (await getCurrentUser()) redirect('/dashboard');

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-12 sm:px-6">
      <div className="mb-8 flex justify-end">
        <ThemeToggle />
      </div>

      <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Habit Tracker</h1>
      <p className="text-muted-foreground mt-3 max-w-xl text-base sm:text-lg">
        Check in once a day and watch your streak grow — counted in your own local days,
        never in elapsed hours.
      </p>

      <div className="mt-7 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/signup">Create an account</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/login">Log in</Link>
        </Button>
      </div>

      <ul className="mt-12 grid gap-6 sm:grid-cols-3">
        {POINTS.map(({ Icon, title, body }) => (
          <li key={title}>
            <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
              <Icon className="size-4" />
            </div>
            <h2 className="mt-3 text-sm font-semibold">{title}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{body}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
