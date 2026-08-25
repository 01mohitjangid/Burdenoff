import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({
  prisma: {
    habit: { findFirst: vi.fn() },
    checkIn: { create: vi.fn(), findMany: vi.fn() },
  },
}));

import { fakeCheckInTable } from '../../../test/fake-check-in-table';
import type { PublicUser } from '@/lib/api-contract';
import { ApiError } from '../api-error';
import { prisma } from '../db';
import { createCheckIn } from './check-in.service';

const findFirst = prisma.habit.findFirst as unknown as Mock;
const create = prisma.checkIn.create as unknown as Mock;
const findMany = prisma.checkIn.findMany as unknown as Mock;

const kolkata: PublicUser = {
  id: 'user_1',
  email: 'mohit@example.com',
  timeZone: 'Asia/Kolkata',
};
const london: PublicUser = { id: 'user_2', email: 'a@b.co', timeZone: 'Europe/London' };

/** A habit created well before every date these tests use. */
const habit = {
  id: 'habit_1',
  name: 'Drink water',
  description: null,
  createdAt: new Date('2026-03-01T04:00:00Z'),
};

/** Seeds the shared fake with days belonging to one habit. */
function seedCheckIns(days: string[] = [], habitId = habit.id) {
  return fakeCheckInTable(
    { create, findMany },
    days.map((localDay) => ({ habitId, localDay }))
  );
}

async function errorFrom(promise: Promise<unknown>): Promise<ApiError> {
  const result = await promise.catch((error: unknown) => error);
  expect(result).toBeInstanceOf(ApiError);
  return result as ApiError;
}

beforeEach(() => {
  vi.clearAllMocks();
  findFirst.mockResolvedValue(habit);
});

describe('rule 1: the habit must belong to the caller', () => {
  it('reports another user’s habit as missing, not as forbidden', async () => {
    // A 403 would confirm the id exists, which is a leak in itself.
    findFirst.mockResolvedValue(null);
    seedCheckIns();

    const error = await errorFrom(
      createCheckIn({ user: kolkata, habitId: 'someone-elses-habit' })
    );
    expect(error.status).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(create).not.toHaveBeenCalled();
  });
});

describe('rule 2: the day cannot be in the caller’s own future', () => {
  it('rejects tomorrow', async () => {
    seedCheckIns();
    const now = new Date('2026-03-12T10:00:00Z');

    const error = await errorFrom(
      createCheckIn({ user: kolkata, habitId: habit.id, localDay: '2026-03-13', now })
    );
    expect(error.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('is decided per user, not per server clock', async () => {
    // One instant. In Kolkata it is already the 12th; in London it is still the
    // 11th. So the same request is valid for one user and premature for the
    // other, which is the whole point of the rule.
    const now = new Date('2026-03-11T21:30:00Z');

    seedCheckIns();
    await expect(
      createCheckIn({ user: kolkata, habitId: habit.id, localDay: '2026-03-12', now })
    ).resolves.toMatchObject({ today: '2026-03-12' });

    seedCheckIns();
    const error = await errorFrom(
      createCheckIn({ user: london, habitId: habit.id, localDay: '2026-03-12', now })
    );
    expect(error.status).toBe(400);
  });

  it('accepts today itself, right up to the last minute of it', async () => {
    seedCheckIns();
    // 23:59 local in Kolkata is 18:29Z the same day.
    const now = new Date('2026-03-12T18:29:00Z');

    await expect(
      createCheckIn({ user: kolkata, habitId: habit.id, now })
    ).resolves.toMatchObject({ checkIn: { localDay: '2026-03-12' } });
  });
});

describe('rule 3: the day cannot be before the habit existed', () => {
  it('rejects a day before the habit was created', async () => {
    seedCheckIns();
    const now = new Date('2026-03-12T10:00:00Z');

    const error = await errorFrom(
      createCheckIn({ user: kolkata, habitId: habit.id, localDay: '2026-02-28', now })
    );
    expect(error.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('accepts the creation day itself', async () => {
    seedCheckIns();
    const now = new Date('2026-03-12T10:00:00Z');

    // Created at 04:00Z on the 1st, which is 09:30 on the 1st in Kolkata.
    await expect(
      createCheckIn({ user: kolkata, habitId: habit.id, localDay: '2026-03-01', now })
    ).resolves.toMatchObject({ checkIn: { localDay: '2026-03-01' } });
  });

  it('measures the creation day in the caller’s calendar', async () => {
    // Created 22:00Z on the 1st: still the 1st in London, already the 2nd in
    // Kolkata. So the 1st is backfillable for one user and not the other.
    const lateCreation = { ...habit, createdAt: new Date('2026-03-01T22:00:00Z') };
    findFirst.mockResolvedValue(lateCreation);
    const now = new Date('2026-03-12T10:00:00Z');

    seedCheckIns();
    await expect(
      createCheckIn({ user: london, habitId: habit.id, localDay: '2026-03-01', now })
    ).resolves.toMatchObject({ habit: { startedOn: '2026-03-01' } });

    seedCheckIns();
    const error = await errorFrom(
      createCheckIn({ user: kolkata, habitId: habit.id, localDay: '2026-03-01', now })
    );
    expect(error.status).toBe(400);
  });
});

describe('rule 4: one check-in per habit per local day', () => {
  it('rejects a second check-in for the same day with 409', async () => {
    seedCheckIns(['2026-03-12']);
    const now = new Date('2026-03-12T10:00:00Z');

    const error = await errorFrom(
      createCheckIn({ user: kolkata, habitId: habit.id, now })
    );
    expect(error.status).toBe(409);
    expect(error.code).toBe('DUPLICATE_CHECK_IN');
  });

  it('leans on the unique index rather than reading first', async () => {
    // Reading then inserting would still lose the race, and a double-tapped
    // button is exactly that race.
    seedCheckIns(['2026-03-12']);
    const now = new Date('2026-03-12T10:00:00Z');

    await errorFrom(createCheckIn({ user: kolkata, habitId: habit.id, now }));
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe('streaks after a write', () => {
  it('returns the streak recomputed, so the caller need not refetch', async () => {
    seedCheckIns(['2026-03-10', '2026-03-11']);
    const now = new Date('2026-03-12T10:00:00Z');

    const result = await createCheckIn({ user: kolkata, habitId: habit.id, now });
    expect(result.habit).toMatchObject({
      currentStreak: 3,
      longestStreak: 3,
      checkedInToday: true,
    });
  });

  it('re-computes correctly when a backfill closes a gap', async () => {
    // Two islands either side of a missing day: current streak is 1.
    seedCheckIns(['2026-03-10', '2026-03-12']);
    const now = new Date('2026-03-12T10:00:00Z');

    // Backfilling the 11th joins them into a run of three.
    const result = await createCheckIn({
      user: kolkata,
      habitId: habit.id,
      localDay: '2026-03-11',
      now,
    });

    expect(result.habit).toMatchObject({ currentStreak: 3, longestStreak: 3 });
  });

  it('walks through the worked example from the brief', async () => {
    const stored = seedCheckIns();
    const checkIn = (instant: string) =>
      createCheckIn({ user: kolkata, habitId: habit.id, now: new Date(instant) });

    // A: 14:30Z is 20:00 local on the 10th.
    expect((await checkIn('2026-03-10T14:30:00Z')).habit.currentStreak).toBe(1);
    // B: 20 hours later, but a new local day.
    expect((await checkIn('2026-03-11T10:30:00Z')).habit.currentStreak).toBe(2);
    // C: only 11 hours after B, yet another new local day.
    expect((await checkIn('2026-03-11T21:30:00Z')).habit.currentStreak).toBe(3);

    // D: 20 hours after C, but the same local day as C.
    const error = await errorFrom(checkIn('2026-03-12T17:30:00Z'));
    expect(error.code).toBe('DUPLICATE_CHECK_IN');

    // Exactly three rows were ever written, so the streak the brief expects is
    // three and the rejected duplicate changed nothing.
    expect(stored.map((row) => row.localDay)).toEqual([
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
    ]);
  });
});

describe('scoping', () => {
  it('does not count another habit’s check-ins towards this habit', async () => {
    // The unique key is [habitId, localDay], not localDay. A second habit being
    // done on the same day is normal, not a duplicate.
    const table = seedCheckIns(['2026-03-12'], 'a_different_habit');
    const now = new Date('2026-03-12T10:00:00Z');

    const result = await createCheckIn({ user: kolkata, habitId: habit.id, now });

    expect(result.habit.currentStreak).toBe(1);
    expect(table).toHaveLength(2);
  });

  it('only reads the days belonging to this habit', async () => {
    seedCheckIns(['2026-03-01', '2026-03-02'], 'a_different_habit');
    const now = new Date('2026-03-12T10:00:00Z');

    const result = await createCheckIn({ user: kolkata, habitId: habit.id, now });

    // A query that dropped its filter would blend the other habit's days in and
    // report a longest streak of two.
    expect(result.habit).toMatchObject({ currentStreak: 1, longestStreak: 1 });
  });
});

describe('when the database clock and the app clock disagree', () => {
  it('still lets a brand-new habit be checked in for today', async () => {
    // createdAt comes from the database, today from this process. If the two
    // straddle the user's local midnight, an unclamped start date would put the
    // habit's first day in the user's future and lock it out entirely.
    findFirst.mockResolvedValue({
      ...habit,
      createdAt: new Date('2026-03-12T18:30:02Z'), // 00:00:02 on the 13th in Kolkata
    });
    seedCheckIns();
    const now = new Date('2026-03-12T18:29:59Z'); // still 23:59:59 on the 12th

    const result = await createCheckIn({ user: kolkata, habitId: habit.id, now });

    expect(result.checkIn.localDay).toBe('2026-03-12');
    expect(result.habit.startedOn).toBe('2026-03-12');
  });
});
