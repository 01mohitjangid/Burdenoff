import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getCurrentUser } from '@/server/session';

export const metadata = { title: 'Log in · Habit Tracker' };

// Reads the session cookie, so it can never be cached.
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/dashboard');

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mb-4 flex justify-end">
        <ThemeToggle />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Log in</CardTitle>
          <CardDescription>Welcome back.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        No account yet?{' '}
        <Link
          href="/signup"
          className="text-foreground font-medium underline underline-offset-4"
        >
          Sign up
        </Link>
      </p>
    </main>
  );
}
