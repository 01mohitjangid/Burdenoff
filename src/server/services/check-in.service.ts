import 'server-only';
import type { CheckInRecord, HabitSummary, PublicUser } from '@/lib/api-contract';
import { type LocalDay, compareLocalDays, todayIn } from '@/lib/local-day';
import { ApiError } from '../api-error';
import { prisma } from '../db';
import { isUniqueViolation } from '../prisma-errors';
import {
  loadCheckInDays,
  loadOwnedHabit,
  startedOnFor,
  toCheckInRecord,
  toHabitSummary,
} from './habit.service';

const CHECK_IN_SELECT = {
  id: true,
  localDay: true,
  checkedInAt: true,
} as const;

export interface CreateCheckInParams {
  user: PublicUser;
  habitId: string;
  /** Omitted means today. A past day is a backfill. */
  localDay?: LocalDay;
  /** Injectable clock, so the rules can be tested without waiting for a date. */
  now?: Date;
}

/**
 * Records that a habit was done on one local day.
 *
 * Four rules apply, and all four are enforced here rather than in the route, so
 * they hold no matter who calls:
 *
 *   1. The habit must belong to this user.
 *   2. The day cannot be in the user's own future.
 *   3. The day cannot be before the habit existed.
 *   4. The day cannot already have a check-in.
 *
 * "Future" means future for this user. It is 2026-03-12 in Kolkata while it is
 * still 2026-03-11 in London, so the same request is a valid check-in for one
 * user and a future date for another.
 */
export async function createCheckIn({
  user,
  habitId,
  localDay,
  now = new Date(),
}: CreateCheckInParams): Promise<{
  checkIn: CheckInRecord;
  habit: HabitSummary;
  today: LocalDay;
}> {
  // 1. Ownership. Reported as missing, not forbidden, so a foreign id is not
  //    confirmed to exist.
  const habit = await loadOwnedHabit(habitId, user.id);

  const today = todayIn(user.timeZone, now);
  const day = localDay ?? today;

  // 2. Not in this user's future.
  if (compareLocalDays(day, today) > 0) {
    throw ApiError.validation(
      'You cannot check in for a day that has not happened yet.',
      {
        localDay: ['That day is still in the future for you.'],
      }
    );
  }

  // 3. Not before the habit existed. The habit's creation instant is converted
  //    into the user's calendar, so the comparison is day against day.
  const startedOn = startedOnFor(habit, user.timeZone, today);
  if (compareLocalDays(day, startedOn) < 0) {
    throw ApiError.validation('You cannot check in for a day before the habit existed.', {
      localDay: [`This habit only starts on ${startedOn}.`],
    });
  }

  // 4. One check-in per habit per local day. Inserting and catching the unique
  //    violation is deliberate: reading first and then inserting would still
  //    lose the race between the two, and a double-tapped button is exactly
  //    that race.
  const checkIn = await insertCheckIn(habitId, day, now);

  const localDays = await loadCheckInDays(habit);
  return {
    checkIn: toCheckInRecord(checkIn),
    habit: toHabitSummary(habit, localDays, today, user.timeZone),
    today,
  };
}

async function insertCheckIn(habitId: string, localDay: LocalDay, now: Date) {
  try {
    return await prisma.checkIn.create({
      data: { habitId, localDay, checkedInAt: now },
      select: CHECK_IN_SELECT,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(
        409,
        'DUPLICATE_CHECK_IN',
        'This habit is already checked in for that day.',
        { localDay: [`${localDay} is already done.`] }
      );
    }
    throw error;
  }
}
