import { SearchXIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Not found · Habit Tracker' };

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-start justify-center gap-4 px-4 py-16 sm:px-6">
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
    </main>
  );
}
