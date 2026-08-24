export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-3 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Habit Tracker</h1>
      <p className="text-muted text-base">
        Check in once a day and watch your streak grow. Streaks are counted in your own
        local days, not in elapsed hours.
      </p>
      <p className="text-muted border-border mt-4 border-t pt-4 text-sm">
        Sign-up, habits and the dashboard land in the next steps.
      </p>
    </main>
  );
}
