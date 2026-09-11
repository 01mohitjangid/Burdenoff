import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The page container every route shares.
 *
 * Page width lives here and nowhere else, so a new route cannot quietly ship
 * with a different one. `app` is the wide shell the signed-in pages use, and it
 * only pays off because those pages lay their content out in columns — a single
 * stacked column at this width just stretches. `narrow` keeps one form or one
 * message at a readable size, which is what a login box and a 404 want.
 */
const WIDTHS = {
  app: 'max-w-7xl',
  narrow: 'max-w-md',
} as const;

/**
 * The width and gutter half of the shell, without the vertical padding.
 *
 * Exported so the navbar can line its contents up with the page below it. It
 * has to come from here: two copies of these classes would drift, and the brand
 * would end up a few pixels off the page heading.
 */
export function shellWidth(width: keyof typeof WIDTHS = 'app') {
  // The gutter grows with the viewport so content never touches the edge of a
  // wide monitor.
  return cn('mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-12', WIDTHS[width]);
}

interface Props {
  width?: keyof typeof WIDTHS;
  className?: string;
  children: ReactNode;
}

export function PageShell({ width = 'app', className, children }: Props) {
  return (
    <main className={cn(shellWidth(width), 'flex-1 py-8 sm:py-10', className)}>
      {children}
    </main>
  );
}
