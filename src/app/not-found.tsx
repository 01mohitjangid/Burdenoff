import { SearchXIcon } from 'lucide-react';
import Link from 'next/link';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Not found · Habit Tracker' };

export default function NotFound() {
  return (
    <PageShell width="narrow" className="flex flex-col items-start justify-center gap-4">
      <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
        <SearchXIcon className="size-5" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          That page does not exist, or it belongs to somebody else.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/dashboard">Back to your habits</Link>
      </Button>
    </PageShell>
  );
}
