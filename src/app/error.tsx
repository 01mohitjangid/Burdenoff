'use client';

import { TriangleAlertIcon } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * The last line of defence for a page that threw.
 *
 * `error.message` is deliberately not shown: in production Next replaces it
 * with a digest anyway, and in development printing it here would be the one
 * place a database message could reach a browser.
 */
export default function ErrorBoundary({ reset }: Props) {
  return (
    <PageShell width="narrow" className="flex flex-col items-start justify-center gap-4">
      <div className="bg-destructive/10 text-destructive flex size-10 items-center justify-center rounded-lg">
        <TriangleAlertIcon className="size-5" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          The page could not be loaded. Trying again often works.
        </p>
      </div>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </PageShell>
  );
}
