import { Prisma } from '@prisma/client';
import type { Mock } from 'vitest';

export interface FakeCheckInRow {
  id: string;
  habitId: string;
  localDay: string;
  checkedInAt: Date;
}

export interface FakeCheckInSeed {
  habitId: string;
  localDay: string;
  checkedInAt?: Date;
}

interface CheckInMocks {
  create: Mock;
  findMany: Mock;
}

interface FindManyArgs {
  where?: { habitId?: string | { in?: string[] } };
  select?: Record<string, boolean>;
  orderBy?: { localDay?: 'asc' | 'desc' };
}

/**
 * An in-memory stand-in for the `check_ins` table.
 *
 * It exists because a `mockResolvedValue` stub answers every query with the same
 * rows, which means a query that forgot its `where` clause — and so returned
 * every user's check-ins — reads as passing. This fake instead behaves like the
 * table:
 *
 *   - the duplicate check is keyed on `[habitId, localDay]`, exactly like the
 *     real unique index, so a second habit done on the same day is not a clash;
 *   - `findMany` honours `where.habitId`, refuses a query that has no habit
 *     filter at all, and rejects a filter shape it does not understand rather
 *     than quietly matching everything;
 *   - `select` is applied, so an over-selected column shows up in the result.
 *
 * Shared between the habit and check-in service tests on purpose. Hardening one
 * copy of a fake just moves the blind spot to the other one.
 */
export function fakeCheckInTable(
  mocks: CheckInMocks,
  seed: FakeCheckInSeed[] = []
): FakeCheckInRow[] {
  const stored: FakeCheckInRow[] = seed.map((row, index) => ({
    id: `check_in_seed_${index + 1}`,
    habitId: row.habitId,
    localDay: row.localDay,
    checkedInAt: row.checkedInAt ?? new Date(`${row.localDay}T12:00:00Z`),
  }));

  mocks.create.mockImplementation(
    ({
      data,
      select,
    }: {
      data: { habitId: string; localDay: string; checkedInAt: Date };
      select?: Record<string, boolean>;
    }) => {
      const clashes = stored.some(
        (row) => row.habitId === data.habitId && row.localDay === data.localDay
      );
      if (clashes) throw uniqueViolation();

      const row: FakeCheckInRow = {
        id: `check_in_${stored.length + 1}`,
        habitId: data.habitId,
        localDay: data.localDay,
        checkedInAt: data.checkedInAt,
      };
      stored.push(row);
      return project(row, select);
    }
  );

  mocks.findMany.mockImplementation(({ where, select, orderBy }: FindManyArgs = {}) => {
    const matching = stored.filter((row) => matchesHabit(row, where?.habitId));

    if (orderBy?.localDay) {
      const direction = orderBy.localDay === 'desc' ? -1 : 1;
      matching.sort((a, b) => (a.localDay < b.localDay ? -direction : direction));
    }

    return matching.map((row) => project(row, select));
  });

  return stored;
}

type HabitFilter = string | { in?: string[] } | undefined;

function matchesHabit(row: FakeCheckInRow, filter: HabitFilter): boolean {
  if (filter === undefined) {
    throw new Error('check_ins findMany was called with no habitId filter');
  }
  if (typeof filter === 'string') return row.habitId === filter;
  if (Array.isArray(filter.in)) return filter.in.includes(row.habitId);

  throw new Error(
    `check_ins findMany was called with an unsupported habitId filter: ${JSON.stringify(filter)}`
  );
}

function project(row: FakeCheckInRow, select?: Record<string, boolean>) {
  if (!select) return { ...row };

  const projected: Record<string, unknown> = {};
  for (const [column, wanted] of Object.entries(select)) {
    if (wanted) projected[column] = row[column as keyof FakeCheckInRow];
  }
  return projected;
}

/**
 * The real Prisma error class, not a look-alike.
 *
 * `isUniqueViolation` narrows with `instanceof`, so a hand-rolled Error object
 * carrying `code: 'P2002'` would slip past it and surface as a 500 — the fake
 * would be testing a path the application never takes.
 */
function uniqueViolation(): Error {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}
