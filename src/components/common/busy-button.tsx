'use client';

import { Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ComponentProps } from 'react';

interface Props extends Omit<ComponentProps<typeof Button>, 'aria-busy'> {
  busy?: boolean;
  busyLabel?: string;
}

/**
 * A button that cannot be pressed twice while its work is in flight.
 *
 * `aria-busy` tells a screen reader it is working rather than stuck, and the
 * disabled state is what closes the double-submit window — pressing "check in"
 * twice would otherwise earn a duplicate error on the app's main action.
 */
export function BusyButton({
  busy = false,
  busyLabel,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <Button {...rest} disabled={busy || disabled} aria-busy={busy}>
      {busy ? <Loader2Icon className="size-4 animate-spin" /> : null}
      {busy && busyLabel ? busyLabel : children}
    </Button>
  );
}
