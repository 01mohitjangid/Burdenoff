import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignupForm } from '@/components/signup-form';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getCurrentUser } from '@/server/session';

export const metadata = { title: 'Sign up · Habit Tracker' };

export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  // Already logged in: there is nothing to sign up for.
  if (await getCurrentUser()) redirect('/dashboard');

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mb-4 flex justify-end">
        <ThemeToggle />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Pick the time zone you actually live in. Every streak is counted in its days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm />
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Already have an account?{' '}
        <Link
          href="/login"
          className="text-foreground font-medium underline underline-offset-4"
        >
          Log in
        </Link>
      </p>
    </main>
  );
}
