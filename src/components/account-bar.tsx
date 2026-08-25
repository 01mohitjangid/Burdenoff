import { UserRoundIcon } from 'lucide-react';
import type { PublicUser } from '@/lib/api-contract';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SignOutButton } from './sign-out-button';
import { ThemeToggle } from './theme-toggle';

interface Props {
  user: PublicUser;
}

/**
 * The signed-in user and a way out.
 *
 * Shared by every authenticated page, so adding a page cannot quietly ship one
 * with no way to sign out.
 */
export function AccountBar({ user }: Props) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Account">
            <UserRoundIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-normal">
            {/* An email may be 254 characters with no spaces to break on, so it
                is truncated; the title is what lets a sighted user recover it,
                and CSS truncation keeps it whole for a screen reader. */}
            <p className="truncate text-sm font-medium" title={user.email}>
              {user.email}
            </p>
            <p className="text-muted-foreground truncate text-xs">{user.timeZone}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <SignOutButton />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
