'use client';

import { SaveIcon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { fieldsFor, messageFor } from '@/client/api-client';
import { deleteHabit, updateHabit } from '@/client/habits.api';
import type { FieldErrors, HabitSummary } from '@/lib/api-contract';
import { MAX_HABIT_NAME_LENGTH } from '@/lib/limits';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BusyButton } from './busy-button';
import { ErrorBanner } from './error-banner';
import { FieldError } from './field-error';

interface Props {
  habit: HabitSummary;
}

/** Rename or delete one habit. */
export function HabitActions({ habit }: Props) {
  const router = useRouter();
  const [name, setName] = useState(habit.name);
  const [description, setDescription] = useState(habit.description ?? '');
  const [working, setWorking] = useState<'save' | 'delete' | null>(null);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [fields, setFields] = useState<FieldErrors>({});

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setWorking('save');
    setError('');
    setFields({});

    try {
      await updateHabit(habit.id, { name, description: description || null });
      toast.success('Habit updated');
      startTransition(() => router.refresh());
    } catch (thrown) {
      setError(messageFor(thrown));
      setFields(fieldsFor(thrown));
    } finally {
      setWorking(null);
    }
  }

  async function onDelete() {
    setWorking('delete');
    setError('');

    try {
      await deleteHabit(habit.id);
      toast.success(`${habit.name} deleted`);
      // The habit no longer exists, so there is no page left to refresh.
      router.push('/dashboard');
      router.refresh();
    } catch (thrown) {
      setError(messageFor(thrown));
      setWorking(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit this habit</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={MAX_HABIT_NAME_LENGTH}
              required
              aria-invalid={Boolean(fields.name?.length)}
              aria-describedby="edit-name-error"
            />
            <FieldError fields={fields} name="name" id="edit-name-error" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-description">Description</Label>
            <Input
              id="edit-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional"
              aria-invalid={Boolean(fields.description?.length)}
              aria-describedby="edit-description-error"
            />
            <FieldError fields={fields} name="description" id="edit-description-error" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <BusyButton
              busy={working === 'save' || refreshing}
              busyLabel="Saving…"
              // Disabled during a delete too, or saving could race the removal
              // and land on a habit that no longer exists.
              disabled={working === 'delete'}
            >
              <SaveIcon className="size-4" />
              Save changes
            </BusyButton>

            {/* A dialog rather than a swapped-in button pair: it traps focus,
                returns it to the trigger on close, and closes on Escape — all
                things a hand-rolled confirmation has to remember to do. */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive"
                  disabled={working !== null}
                >
                  <Trash2Icon className="size-4" />
                  Delete habit
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{habit.name}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Its{' '}
                    {habit.longestStreak === 0 ? 'history' : 'entire check-in history'}{' '}
                    goes with it. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, delete it
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <ErrorBanner message={error} />
        </form>
      </CardContent>
    </Card>
  );
}
