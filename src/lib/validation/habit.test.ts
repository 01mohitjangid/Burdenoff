import { describe, expect, it } from 'vitest';
import {
  MAX_HABIT_DESCRIPTION_LENGTH,
  MAX_HABIT_NAME_LENGTH,
  createCheckInSchema,
  createHabitSchema,
  updateHabitSchema,
} from './habit';

describe('createHabitSchema', () => {
  it('accepts a habit with just a name', () => {
    expect(createHabitSchema.parse({ name: 'Drink water' })).toEqual({
      name: 'Drink water',
      description: null,
    });
  });

  it('trims the name', () => {
    expect(createHabitSchema.parse({ name: '  Read  ' }).name).toBe('Read');
  });

  it('treats an empty or whitespace description as no description', () => {
    // Otherwise the database ends up with two different ways to say "nothing".
    expect(
      createHabitSchema.parse({ name: 'Run', description: '' }).description
    ).toBeNull();
    expect(
      createHabitSchema.parse({ name: 'Run', description: '   ' }).description
    ).toBeNull();
    expect(
      createHabitSchema.parse({ name: 'Run', description: null }).description
    ).toBeNull();
  });

  it('rejects a name that is empty once trimmed', () => {
    expect(createHabitSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(createHabitSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejects over-long text', () => {
    const longName = 'a'.repeat(MAX_HABIT_NAME_LENGTH + 1);
    const longDescription = 'a'.repeat(MAX_HABIT_DESCRIPTION_LENGTH + 1);

    expect(createHabitSchema.safeParse({ name: longName }).success).toBe(false);
    expect(
      createHabitSchema.safeParse({ name: 'Run', description: longDescription }).success
    ).toBe(false);
  });

  it('rejects unknown fields rather than dropping them silently', () => {
    expect(
      createHabitSchema.safeParse({ name: 'Run', userId: 'someone-else' }).success
    ).toBe(false);
  });
});

describe('updateHabitSchema', () => {
  it('accepts a single field', () => {
    expect(updateHabitSchema.parse({ name: 'Read more' })).toEqual({ name: 'Read more' });
  });

  it('allows clearing the description', () => {
    expect(updateHabitSchema.parse({ description: '' })).toEqual({ description: null });
  });

  it('rejects an empty patch', () => {
    expect(updateHabitSchema.safeParse({}).success).toBe(false);
  });

  it('rejects unknown fields, which is what stops a habit changing owner', () => {
    // The service passes named columns, but this schema is the first defence:
    // without it a `userId` in the body would be a mass-assignment hole.
    expect(
      updateHabitSchema.safeParse({ name: 'Mine', userId: 'someone-else' }).success
    ).toBe(false);
    expect(
      updateHabitSchema.safeParse({ name: 'Mine', id: 'another-habit' }).success
    ).toBe(false);
  });
});

describe('createCheckInSchema', () => {
  it('accepts an empty body, which means today', () => {
    expect(createCheckInSchema.parse({})).toEqual({});
  });

  it('accepts a real calendar date for a backfill', () => {
    expect(createCheckInSchema.parse({ localDay: '2026-03-11' })).toEqual({
      localDay: '2026-03-11',
    });
  });

  it('rejects a date that is not a real calendar day', () => {
    for (const localDay of ['2026-02-30', '2026-13-01', '2026-3-1', '11-03-2026', '']) {
      expect(createCheckInSchema.safeParse({ localDay }).success).toBe(false);
    }
  });
});
