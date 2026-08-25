import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({
  prisma: {
    habit: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    checkIn: { findMany: vi.fn() },
  },
}));

import { fakeCheckInTable } from '../../../test/fake-check-in-table';
import type { PublicUser } from '@/lib/api-contract';
import { ApiError } from '../api-error';
import { prisma } from '../db';
import {
  createHabit,
  deleteHabit,
  getHabitDetail,
  listHabits,
  startedOnFor,
  toHabitSummary,
  updateHabit,
} from './habit.service';

const findFirst = prisma.habit.findFirst as unknown as Mock;
const findManyHabits = prisma.habit.findMany as unknown as Mock;
const updateOne = prisma.habit.update as unknown as Mock;
const deleteOne = prisma.habit.delete as unknown as Mock;
const createOne = prisma.habit.create as unknown as Mock;
const createCheckInRow = vi.fn();
const findManyCheckIns = prisma.checkIn.findMany as unknown as Mock;

/** Seeds the shared fake, which honours `where` instead of ignoring it. */
function seedCheckIns(seed: { habitId: string; localDay: string }[] = []) {
  return fakeCheckInTable({ create: createCheckInRow, findMany: findManyCheckIns }, seed);
}

const user: PublicUser = {
  id: 'user_1',
  email: 'mohit@example.com',
  timeZone: 'Asia/Kolkata',
};

const water = {
  id: 'habit_water',
  name: 'Drink water',
  description: null,
  createdAt: new Date('2026-03-01T04:00:00Z'),
};
const read = {
  id: 'habit_read',
  name: 'Read',
  description: 'Ten pages',
  createdAt: new Date('2026-03-05T04:00:00Z'),
};

const now = new Date('2026-03-12T10:00:00Z'); // 15:30 on the 12th in Kolkata

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listHabits', () => {
  it('gives each habit its own streaks', async () => {
    findManyHabits.mockResolvedValue([water, read]);
    seedCheckIns([
      { habitId: water.id, localDay: '2026-03-11' },
      { habitId: water.id, localDay: '2026-03-12' },
      { habitId: read.id, localDay: '2026-03-05' },
      // Another user's habit. A query that dropped its filter would fold these
      // into the dashboard's streaks.
      { habitId: 'a_stranger_habit', localDay: '2026-03-09' },
      { habitId: 'a_stranger_habit', localDay: '2026-03-10' },
      { habitId: 'a_stranger_habit', localDay: '2026-03-11' },
    ]);

    const { habits, today } = await listHabits(user, now);

    expect(today).toBe('2026-03-12');
    expect(habits[0]).toMatchObject({
      name: 'Drink water',
      currentStreak: 2,
      longestStreak: 2,
      checkedInToday: true,
    });
    expect(habits[1]).toMatchObject({
      name: 'Read',
      currentStreak: 0, // last done on the 5th, so the streak is long dead
      longestStreak: 1,
      checkedInToday: false,
    });
  });

  it('reads every habit’s check-ins in one query, not one query per habit', async () => {
    findManyHabits.mockResolvedValue([water, read]);
    seedCheckIns();

    await listHabits(user, now);
    expect(findManyCheckIns).toHaveBeenCalledTimes(1);
    expect(findManyCheckIns.mock.calls[0][0].where).toEqual({
      habitId: { in: [water.id, read.id] },
    });
  });

  it('does not go looking for check-ins when there are no habits', async () => {
    findManyHabits.mockResolvedValue([]);

    await expect(listHabits(user, now)).resolves.toEqual({
      habits: [],
      today: '2026-03-12',
    });
    expect(findManyCheckIns).not.toHaveBeenCalled();
  });

  it('only ever asks for this user’s habits', async () => {
    findManyHabits.mockResolvedValue([]);

    await listHabits(user, now);
    expect(findManyHabits.mock.calls[0][0].where).toEqual({ userId: user.id });
  });
});

describe('toHabitSummary', () => {
  it('reports the creation day in the caller’s calendar', () => {
    // Created 22:00Z on the 1st: still the 1st in London, already the 2nd in
    // Kolkata. The earliest backfillable day differs accordingly.
    const late = { ...water, createdAt: new Date('2026-03-01T22:00:00Z') };

    expect(toHabitSummary(late, [], '2026-03-12', 'Europe/London').startedOn).toBe(
      '2026-03-01'
    );
    expect(toHabitSummary(late, [], '2026-03-12', 'Asia/Kolkata').startedOn).toBe(
      '2026-03-02'
    );
  });

  it('marks a habit done today only when today is in its days', () => {
    expect(
      toHabitSummary(water, ['2026-03-12'], '2026-03-12', user.timeZone)
    ).toMatchObject({
      checkedInToday: true,
      currentStreak: 1,
    });
    expect(
      toHabitSummary(water, ['2026-03-11'], '2026-03-12', user.timeZone)
    ).toMatchObject({
      checkedInToday: false,
      // Yesterday still counts: today is not over yet.
      currentStreak: 1,
    });
  });
});

describe('ownership', () => {
  it('refuses to update a habit the caller does not own', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      updateHabit(user, 'someone-elses', { name: 'Mine now' })
    ).rejects.toBeInstanceOf(ApiError);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('refuses to delete a habit the caller does not own', async () => {
    findFirst.mockResolvedValue(null);

    const error = await deleteHabit(user, 'someone-elses').catch((e: ApiError) => e);
    expect((error as ApiError).status).toBe(404);
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it('scopes the ownership lookup by user, not just by habit id', async () => {
    findFirst.mockResolvedValue(water);
    deleteOne.mockResolvedValue(water);

    await deleteHabit(user, water.id);
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: water.id, userId: user.id });
    // The write is scoped too, so ownership is a property of the delete itself
    // rather than of the order the two statements happen to run in.
    expect(deleteOne.mock.calls[0][0].where).toEqual({ id: water.id, userId: user.id });
  });
});

describe('createHabit', () => {
  it('files the habit under the caller, never under an id from the request', async () => {
    createOne.mockResolvedValue(water);

    await createHabit(user, { name: 'Drink water', description: null }, now);

    expect(createOne.mock.calls[0][0].data).toEqual({
      userId: user.id,
      name: 'Drink water',
      description: null,
    });
  });

  it('starts a new habit at zero', async () => {
    createOne.mockResolvedValue(water);

    const { habit } = await createHabit(
      user,
      { name: 'Drink water', description: null },
      now
    );
    expect(habit).toMatchObject({
      currentStreak: 0,
      longestStreak: 0,
      checkedInToday: false,
    });
  });
});

describe('updateHabit', () => {
  it('writes only the columns it means to write', async () => {
    // `.strict()` on the schema is the first defence against a `userId` in the
    // body. Naming the columns here means one write does not depend on a
    // validator somewhere else staying strict.
    findFirst.mockResolvedValue(water);
    updateOne.mockResolvedValue({ ...water, name: 'Hydrate' });
    seedCheckIns();

    await updateHabit(user, water.id, { name: 'Hydrate' }, now);

    const call = updateOne.mock.calls[0][0];
    expect(Object.keys(call.data).sort()).toEqual(['description', 'name']);
    expect(call.where).toEqual({ id: water.id, userId: user.id });
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: water.id, userId: user.id });
  });

  it('returns this habit’s streaks, not another habit’s', async () => {
    findFirst.mockResolvedValue(water);
    updateOne.mockResolvedValue({ ...water, name: 'Hydrate' });
    seedCheckIns([
      { habitId: water.id, localDay: '2026-03-12' },
      // A longer run belonging to something else. If the summary were built
      // from the wrong habit's days, these would show up as the answer.
      { habitId: 'a_stranger_habit', localDay: '2026-03-09' },
      { habitId: 'a_stranger_habit', localDay: '2026-03-10' },
      { habitId: 'a_stranger_habit', localDay: '2026-03-11' },
      { habitId: 'a_stranger_habit', localDay: '2026-03-12' },
    ]);

    const { habit } = await updateHabit(user, water.id, { name: 'Hydrate' }, now);

    expect(habit).toMatchObject({ currentStreak: 1, longestStreak: 1 });
  });
});

describe('getHabitDetail', () => {
  it('returns the history newest first, with the streaks alongside', async () => {
    findFirst.mockResolvedValue(water);
    seedCheckIns([
      { habitId: water.id, localDay: '2026-03-11' },
      { habitId: water.id, localDay: '2026-03-12' },
      // Belongs to a different habit entirely.
      { habitId: read.id, localDay: '2026-03-10' },
    ]);

    const detail = await getHabitDetail(user, water.id, now);

    expect(detail.checkIns.map((row) => row.localDay)).toEqual([
      '2026-03-12',
      '2026-03-11',
    ]);
    expect(detail.habit).toMatchObject({ currentStreak: 2, checkedInToday: true });
    expect(findManyCheckIns.mock.calls[0][0].orderBy).toEqual({ localDay: 'desc' });
  });

  it('refuses a habit the caller does not own', async () => {
    findFirst.mockResolvedValue(null);

    const error = await getHabitDetail(user, 'someone-elses').catch((e: ApiError) => e);
    expect((error as ApiError).status).toBe(404);
    expect(findManyCheckIns).not.toHaveBeenCalled();
  });
});

describe('startedOnFor', () => {
  it('never reports a start date in the user’s future', async () => {
    // The database stamps createdAt from its own clock. If that clock is ahead
    // across the user's local midnight, an unclamped value would make the habit
    // impossible to check in for at all.
    const justAfterMidnight = { ...water, createdAt: new Date('2026-03-12T18:30:02Z') };

    expect(startedOnFor(justAfterMidnight, 'Asia/Kolkata', '2026-03-12')).toBe(
      '2026-03-12'
    );
    // Left alone when the clocks agree.
    expect(startedOnFor(water, 'Asia/Kolkata', '2026-03-12')).toBe('2026-03-01');
  });
});
