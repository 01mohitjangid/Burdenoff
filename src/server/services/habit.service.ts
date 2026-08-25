import 'server-only';
import type { CheckInRecord, HabitSummary, PublicUser } from '@/lib/api-contract';
import { type LocalDay, compareLocalDays, toLocalDay, todayIn } from '@/lib/local-day';
import { computeStreaks } from '@/lib/streaks';
import type { CreateHabitInput, UpdateHabitInput } from '@/lib/validation/habit';
import { ApiError } from '../api-error';
import { prisma } from '../db';

export interface HabitRow {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
}

const HABIT_SELECT = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  // `satisfies` keeps the select and the row shape from drifting apart. A
  // return type alone would not: excess-property checking does not apply to a
  // Prisma result.
} as const satisfies Record<keyof HabitRow, true>;

const CHECK_IN_SELECT = {
  id: true,
  localDay: true,
  checkedInAt: true,
} as const satisfies Record<keyof CheckInRecord, true>;

/**
 * Loads a habit only if this user owns it.
 *
 * A habit belonging to someone else is reported as missing rather than
 * forbidden. A 403 would confirm that the id exists, which is the same leak the
 * login error takes care to avoid.
 */
export async function loadOwnedHabit(habitId: string, userId: string): Promise<HabitRow> {
  const habit = await prisma.habit.findFirst({
    where: { id: habitId, userId },
    select: HABIT_SELECT,
  });

  if (!habit) throw ApiError.notFound('That habit does not exist.');
  return habit;
}

/**
 * The earliest local day this habit can be checked in for.
 *
 * Rule 3 of a check-in and the `startedOn` the UI uses as its lower bound are
 * the same fact, so they read it from here rather than each computing it.
 *
 * The clamp matters: `createdAt` is stamped by the database clock while `today`
 * comes from the application's. If the two disagree across the user's local
 * midnight, an unclamped value would put a brand-new habit's start date in the
 * user's future and make it impossible to check in for at all.
 */
export function startedOnFor(
  habit: HabitRow,
  timeZone: string,
  today: LocalDay
): LocalDay {
  const created = toLocalDay(habit.createdAt, timeZone);
  return compareLocalDays(created, today) > 0 ? today : created;
}

/**
 * Turns a habit row plus its check-in days into what the API returns.
 *
 * The time zone is used for exactly two things: working out the user's today,
 * and working out which local day the habit was created on. The streak maths
 * itself never sees a time zone.
 */
export function toHabitSummary(
  habit: HabitRow,
  localDays: readonly LocalDay[],
  today: LocalDay,
  timeZone: string
): HabitSummary {
  const { currentStreak, longestStreak } = computeStreaks(localDays, today);

  return {
    id: habit.id,
    name: habit.name,
    description: habit.description,
    createdAt: habit.createdAt.toISOString(),
    startedOn: startedOnFor(habit, timeZone, today),
    currentStreak,
    longestStreak,
    checkedInToday: localDays.includes(today),
  };
}

/**
 * Every local day this habit has been checked in for.
 *
 * Takes the loaded habit rather than a bare id, so it cannot be called without
 * having proved ownership first — `loadOwnedHabit` is the only way to get one.
 */
export async function loadCheckInDays(habit: HabitRow): Promise<LocalDay[]> {
  const rows = await prisma.checkIn.findMany({
    where: { habitId: habit.id },
    select: { localDay: true },
  });
  return rows.map((row) => row.localDay);
}

export async function listHabits(
  user: PublicUser,
  now?: Date
): Promise<{ habits: HabitSummary[]; today: LocalDay }> {
  const today = todayIn(user.timeZone, now);
  const habits = await prisma.habit.findMany({
    where: { userId: user.id },
    select: HABIT_SELECT,
    orderBy: { createdAt: 'asc' },
  });

  if (habits.length === 0) return { habits: [], today };

  // One query for every habit's days, rather than one query per habit.
  const rows = await prisma.checkIn.findMany({
    where: { habitId: { in: habits.map((habit) => habit.id) } },
    select: { habitId: true, localDay: true },
  });

  const daysByHabit = new Map<string, LocalDay[]>();
  for (const row of rows) {
    const days = daysByHabit.get(row.habitId);
    if (days) days.push(row.localDay);
    else daysByHabit.set(row.habitId, [row.localDay]);
  }

  return {
    habits: habits.map((habit) =>
      toHabitSummary(habit, daysByHabit.get(habit.id) ?? [], today, user.timeZone)
    ),
    today,
  };
}

export async function createHabit(
  user: PublicUser,
  input: CreateHabitInput,
  now?: Date
): Promise<{ habit: HabitSummary; today: LocalDay }> {
  const habit = await prisma.habit.create({
    data: { userId: user.id, name: input.name, description: input.description },
    select: HABIT_SELECT,
  });

  const today = todayIn(user.timeZone, now);
  return { habit: toHabitSummary(habit, [], today, user.timeZone), today };
}

export async function updateHabit(
  user: PublicUser,
  habitId: string,
  input: UpdateHabitInput,
  now?: Date
): Promise<{ habit: HabitSummary; today: LocalDay }> {
  const existing = await loadOwnedHabit(habitId, user.id);

  const habit = await prisma.habit.update({
    // Scoped by owner as well as id. The ownership check above already covers
    // this; naming the columns here makes it a property of the write rather
    // than of the order the two statements happen to run in.
    where: { id: habitId, userId: user.id },
    // Columns are named rather than spread. `.strict()` on the schema is what
    // stops a `userId` arriving in the body, and one write should not depend on
    // a validator elsewhere staying strict.
    data: { name: input.name, description: input.description },
    select: HABIT_SELECT,
  });

  const today = todayIn(user.timeZone, now);
  const localDays = await loadCheckInDays(existing);
  return { habit: toHabitSummary(habit, localDays, today, user.timeZone), today };
}

export async function deleteHabit(user: PublicUser, habitId: string): Promise<void> {
  await loadOwnedHabit(habitId, user.id);
  // The check-ins go with it: the schema cascades on delete.
  await prisma.habit.delete({ where: { id: habitId, userId: user.id } });
}

export interface HabitDetail {
  habit: HabitSummary;
  checkIns: CheckInRecord[];
  today: LocalDay;
}

/**
 * A habit with its full check-in history, or `null` when this user has no such
 * habit — whether it never existed or belongs to somebody else.
 *
 * Pages use this one. They want to know whether the thing is there, not what
 * HTTP status a route handler would have chosen.
 */
export async function findHabitDetail(
  user: PublicUser,
  habitId: string,
  now?: Date
): Promise<HabitDetail | null> {
  const habit = await prisma.habit.findFirst({
    where: { id: habitId, userId: user.id },
    select: HABIT_SELECT,
  });
  if (!habit) return null;

  return buildHabitDetail(user, habit, now);
}

/**
 * The same thing for a route handler, which wants a 404 to fall out of it.
 *
 * Delegates rather than repeating the lookup: the owner-scoped `where` clause
 * is the one thing in this file that must never drift, so it exists once.
 */
export async function getHabitDetail(
  user: PublicUser,
  habitId: string,
  now?: Date
): Promise<HabitDetail> {
  const detail = await findHabitDetail(user, habitId, now);
  if (!detail) throw ApiError.notFound('That habit does not exist.');
  return detail;
}

async function buildHabitDetail(
  user: PublicUser,
  habit: HabitRow,
  now?: Date
): Promise<HabitDetail> {
  const rows = await prisma.checkIn.findMany({
    where: { habitId: habit.id },
    select: CHECK_IN_SELECT,
    orderBy: { localDay: 'desc' },
  });

  const today = todayIn(user.timeZone, now);
  return {
    habit: toHabitSummary(
      habit,
      rows.map((row) => row.localDay),
      today,
      user.timeZone
    ),
    checkIns: rows.map(toCheckInRecord),
    today,
  };
}

export function toCheckInRecord(row: {
  id: string;
  localDay: string;
  checkedInAt: Date;
}): CheckInRecord {
  return {
    id: row.id,
    localDay: row.localDay,
    checkedInAt: row.checkedInAt.toISOString(),
  };
}
