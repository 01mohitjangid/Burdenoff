'use client';

import { LogOutIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { messageFor } from '@/client/api-client';
import { logout } from '@/client/auth.api';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSignOut() {
    setPending(true);

    try {
      await logout();
      router.push('/login');
      router.refresh();
    } catch (thrown) {
      // Every other action in the app reports its failures. Without this a
      // failed sign-out was an unhandled rejection and the user was left
      // believing they had logged out.
      toast.error(messageFor(thrown));
      setPending(false);
    }
  }

  return (
    <DropdownMenuItem
      variant="destructive"
      disabled={pending}
      // The menu would otherwise close before the request had been sent.
      onSelect={(event) => {
        event.preventDefault();
        void onSignOut();
      }}
    >
      <LogOutIcon className="size-4" />
      {pending ? 'Signing out…' : 'Sign out'}
    </DropdownMenuItem>
  );
}
