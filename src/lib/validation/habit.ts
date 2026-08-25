import { z } from 'zod';
import { MAX_HABIT_DESCRIPTION_LENGTH, MAX_HABIT_NAME_LENGTH } from '../limits';
import { isLocalDay } from '../local-day';

export { MAX_HABIT_DESCRIPTION_LENGTH, MAX_HABIT_NAME_LENGTH } from '../limits';

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Give the habit a name')
  .max(MAX_HABIT_NAME_LENGTH, `Keep the name under ${MAX_HABIT_NAME_LENGTH} characters`);

/**
 * An empty description and no description mean the same thing, so both become
 * `null` rather than leaving two ways to say "nothing" in the database.
 */
const descriptionSchema = z
  .string()
  .trim()
  .max(
    MAX_HABIT_DESCRIPTION_LENGTH,
    `Keep the description under ${MAX_HABIT_DESCRIPTION_LENGTH} characters`
  )
  .transform((value) => (value.length === 0 ? null : value))
  .nullish()
  .transform((value) => value ?? null);

export const createHabitSchema = z
  .object({
    name: nameSchema,
    description: descriptionSchema,
  })
  .strict();

/** Every field optional, but at least one must be present. */
export const updateHabitSchema = z
  .object({
    name: nameSchema.optional(),
    description: descriptionSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field to change');

/**
 * The day a check-in counts for. Omitting it means today, which is what the
 * one-click button sends; supplying a past day is a backfill.
 *
 * Only the shape is checked here. Whether the day is in the user's future, or
 * before the habit existed, depends on the user and the habit, so those rules
 * live in the check-in service.
 */
export const createCheckInSchema = z
  .object({
    localDay: z
      .string()
      .refine(isLocalDay, 'Use a real calendar date in YYYY-MM-DD form')
      .optional(),
  })
  .strict();

export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
export type CreateCheckInInput = z.infer<typeof createCheckInSchema>;
