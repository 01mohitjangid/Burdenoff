import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageShell } from '@/components/page-shell';
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
    <PageShell width="narrow" className="flex flex-col justify-center">
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
    </PageShell>
  );
}
