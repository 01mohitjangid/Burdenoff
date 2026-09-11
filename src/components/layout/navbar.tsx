import { CircleCheckBigIcon } from 'lucide-react';
import Link from 'next/link';
import type { PublicUser } from '@/lib/api-contract';
import { AccountBar } from '@/components/layout/account-bar';
import { shellWidth } from '@/components/layout/page-shell';
import { cn } from '@/lib/utils';

interface Props {
  user: PublicUser;
}

/**
 * The bar across the top of every signed-in page.
 *
 * It is sticky and translucent, so a long habit list scrolls underneath it and
 * the way out is never off screen. The inner container borrows the shell's
 * width rather than restating it, which is what keeps the brand aligned with
 * the page heading directly below.
 *
 * This is the only <header> outside <main>, so it is the page's one banner
 * landmark. The heading blocks inside the pages stay within <main> and do not
 * compete with it.
 */
export function Navbar({ user }: Props) {
  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur-sm">
      <div className={cn(shellWidth(), 'flex h-14 items-center justify-between gap-4')}>
        <Link
          href="/dashboard"
          className="focus-visible:ring-ring flex items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
        >
          <CircleCheckBigIcon className="text-primary size-5 shrink-0" />
          <span>Habit Tracker</span>
        </Link>

        <AccountBar user={user} />
      </div>
    </header>
  );
}
