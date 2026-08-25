'use client';

import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useTimeZones } from '@/hooks/use-time-zones';

interface Props {
  /**
   * The selected zone. Required, and never defaulted here: the caller owns the
   * resolved value so that what is displayed is exactly what gets submitted.
   * A fallback in this component and another in the parent is how the form came
   * to show one zone and post a different one.
   */
  value: string;
  onChange: (timeZone: string) => void;
  id?: string;
  describedBy?: string;
  invalid?: boolean;
}

/**
 * A searchable list rather than a plain dropdown.
 *
 * There are over four hundred zones. Scrolling to `Asia/Calcutta` in a native
 * select is a chore; typing "kol" is not.
 */
export function TimeZonePicker({ value, onChange, id, describedBy, invalid }: Props) {
  const [open, setOpen] = useState(false);
  const zones = useTimeZones();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{value}</span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search time zones…" />
          <CommandList>
            <CommandEmpty>No time zone found.</CommandEmpty>
            <CommandGroup>
              {zones.map((zone) => (
                <CommandItem
                  key={zone}
                  value={zone}
                  onSelect={() => {
                    onChange(zone);
                    setOpen(false);
                  }}
                >
                  <CheckIcon
                    className={cn('size-4', zone === value ? 'opacity-100' : 'opacity-0')}
                  />
                  {zone}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
