import {
  addLocalDays,
  assertLocalDay,
  compareLocalDays,
  differenceInLocalDays,
  type LocalDay,
} from './local-day';

export interface StreakSummary {
  /** Consecutive days ending today, or ending yesterday if today is not logged. */
  currentStreak: number;
  /** The longest consecutive run anywhere in the habit's history. */
  longestStreak: number;
}

/**
 * Streak maths over calendar days.
 *
 * By the time input reaches this function the time zone is already gone: it
 * receives local days, so "consecutive" means consecutive calendar squares.
 * A day that runs 23 hours because of daylight saving is still one day, and
 * two check-ins 20 hours apart are one day or two depending only on which
 * squares they landed on.
 *
 * `today` must be the user's own today, from `todayIn(user.timeZone)`.
 *
 * Known limit: a handful of zones have skipped a calendar date outright when
 * they moved across the date line (Pacific/Apia had no 2011-12-30). Days either
 * side of such a jump read as a gap here. Counting calendar squares is still
 * the right model, and no habit tracker will meet the case.
 */
export function computeStreaks(
  localDays: readonly LocalDay[],
  today: LocalDay
): StreakSummary {
  // Validate up front, so an empty history and a populated one behave the same
  // way on a malformed `today` instead of one returning zeros and one throwing.
  assertLocalDay(today);

  // Duplicates should already be impossible, but streak maths must not depend
  // on that. Days after today cannot count towards anything.
  const days = Array.from(new Set(localDays))
    .filter((day) => compareLocalDays(day, today) <= 0)
    .sort(compareLocalDays);

  if (days.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    run = differenceInLocalDays(days[i], days[i - 1]) === 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  }

  return {
    currentStreak: countCurrentStreak(days, today),
    longestStreak,
  };
}

/**
 * A streak is alive only if it reaches today or yesterday. Anything older means
 * the user has already missed a whole day, so the current streak is zero.
 */
function countCurrentStreak(days: readonly LocalDay[], today: LocalDay): number {
  const mostRecent = days[days.length - 1];
  const yesterday = addLocalDays(today, -1);

  if (mostRecent !== today && mostRecent !== yesterday) {
    return 0;
  }

  let streak = 1;
  for (let i = days.length - 1; i > 0; i -= 1) {
    if (differenceInLocalDays(days[i], days[i - 1]) !== 1) break;
    streak += 1;
  }
  return streak;
}
