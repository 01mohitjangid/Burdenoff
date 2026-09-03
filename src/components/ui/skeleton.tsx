import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * One grey placeholder block, sized by its caller.
 *
 * `motion-safe:` rather than a bare `animate-pulse`: a whole screen of pulsing
 * boxes is exactly what somebody who set `prefers-reduced-motion` asked not to
 * see, and a still block reserves the same space just as well.
 *
 * A skeleton is decorative by definition, so it is hidden from screen readers.
 * The `role="status"` region that wraps it is what announces the wait.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn('bg-muted rounded-md motion-safe:animate-pulse', className)}
      {...props}
    />
  );
}

export { Skeleton };
