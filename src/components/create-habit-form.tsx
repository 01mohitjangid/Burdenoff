'use client';

import { PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { fieldsFor, messageFor } from '@/client/api-client';
import { createHabit } from '@/client/habits.api';
import type { FieldErrors } from '@/lib/api-contract';
import { MAX_HABIT_NAME_LENGTH } from '@/lib/limits';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BusyButton } from './busy-button';
import { ErrorBanner } from './error-banner';
import { FieldError } from './field-error';

export function CreateHabitForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  // `router.refresh()` returns void, so without a transition the button would
  // look idle again before the new habit had appeared in the list.
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [fields, setFields] = useState<FieldErrors>({});

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFields({});

    try {
      const result = await createHabit({ name, description: description || null });
      toast.success(`${result.habit.name} added`);
      setName('');
      setDescription('');
      startTransition(() => router.refresh());
    } catch (thrown) {
      setError(messageFor(thrown));
      setFields(fieldsFor(thrown));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a habit</CardTitle>
        <CardDescription>Something you want to do once a day.</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="habit-name">Name</Label>
              <Input
                id="habit-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Drink water"
                maxLength={MAX_HABIT_NAME_LENGTH}
                required
                aria-invalid={Boolean(fields.name?.length)}
                aria-describedby="habit-name-error"
              />
              <FieldError fields={fields} name="name" id="habit-name-error" />
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="habit-description">Description</Label>
              <Input
                id="habit-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional"
                aria-invalid={Boolean(fields.description?.length)}
                aria-describedby="habit-description-error"
              />
              <FieldError
                fields={fields}
                name="description"
                id="habit-description-error"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <BusyButton busy={saving || refreshing} busyLabel="Adding…">
              <PlusIcon className="size-4" />
              Add habit
            </BusyButton>
          </div>

          <ErrorBanner message={error} />
        </form>
      </CardContent>
    </Card>
  );
}
