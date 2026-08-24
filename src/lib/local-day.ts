/**
 * Local-day primitives.
 *
 * This module is the ONLY place in the codebase that knows about time zones.
 * Everything downstream (validation, streaks, the API, the UI) works with a
 * `LocalDay` string and never touches an offset again.
 *
 * A `LocalDay` is a calendar date in the user's own time zone, written as
 * `YYYY-MM-DD`. It is deliberately a plain string and not a `Date`:
 *
 *   - A `Date` is an instant, so it always drags a time zone along with it.
 *     "2026-03-12" is not an instant; it is a square on a calendar.
 *   - `YYYY-MM-DD` sorts lexicographically in the same order it sorts
 *     chronologically, so plain string sorting is date sorting.
 *   - Day arithmetic on a calendar date is unaffected by daylight saving.
 *     A DST day is 23 or 25 hours long, but it is still exactly one day.
 *
 * Every function here is pure: no clock reads except the explicit `now`
 * argument, no database, no environment. That is what makes it unit testable.
 */

/** A calendar date in some time zone, formatted `YYYY-MM-DD`. */
export type LocalDay = string;

const LOCAL_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * IANA zone IDs are `Area/Location`, sometimes with a third segment such as
 * `America/Argentina/Buenos_Aires`. `UTC` is the one accepted exception.
 */
const IANA_ZONE_PATTERN = /^[A-Za-z_+-]+\/[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+)?$/;

/**
 * `Intl.DateTimeFormat` construction is relatively expensive, and we convert on
 * every check-in read. One formatter per time zone is enough.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;

  // The locale is pinned. A default-locale formatter would return a Buddhist or
  // Islamic year under `th-TH` or `ar-SA`, so the result would depend on the
  // machine the server happens to run on.
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

/**
 * Midnight UTC on a given calendar date, in milliseconds.
 *
 * `Date.UTC` is not used here: it maps years 0-99 to 1900-1999, which would make
 * the module reject dates it can itself produce. `setUTCFullYear` does not.
 */
function utcMillisFor(year: number, month: number, day: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * True when the string is an IANA time zone this runtime can resolve.
 *
 * The shape check is not decoration. `Intl` also accepts bare abbreviations,
 * and it resolves them to a guess: `IST` becomes `Asia/Calcutta` and `EST`
 * becomes `America/Panama`. `IST` means three different zones depending on who
 * is saying it, so silently storing one of them would put a user's whole
 * streak history in the wrong place. Only unambiguous IDs are allowed in.
 *
 * This also rejects the legacy single-segment aliases (`Japan`, `CET`,
 * `EST5EDT`). They are real IANA links, but every zone in
 * `Intl.supportedValuesOf('timeZone')` has a two-segment form, so nothing a
 * time zone picker can offer is lost.
 */
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  if (timeZone !== 'UTC' && !IANA_ZONE_PATTERN.test(timeZone)) return false;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** True when the string is a well-formed and real calendar date. */
export function isLocalDay(value: string): boolean {
  if (!LOCAL_DAY_PATTERN.test(value)) return false;

  // Round-trip through UTC to reject impossible dates such as 2026-02-30,
  // which the pattern alone happily accepts.
  const [year, month, day] = value.split('-').map(Number);

  // The formatter carries no era field, so it renders year 0 and year 1 both
  // as "1". Keeping the domain at year 1 and above means every day this module
  // accepts is a day it can also print back correctly.
  if (year < 1) return false;

  const asUtc = new Date(utcMillisFor(year, month, day));
  return (
    asUtc.getUTCFullYear() === year &&
    asUtc.getUTCMonth() === month - 1 &&
    asUtc.getUTCDate() === day
  );
}

/** Throws unless the value is a real calendar date. */
export function assertLocalDay(value: string): void {
  if (!isLocalDay(value)) {
    throw new RangeError(`Not a valid local day: "${value}"`);
  }
}

/** Splits a local day into its numeric parts. `month` is 1-12. */
export function parseLocalDay(day: LocalDay): {
  year: number;
  month: number;
  day: number;
} {
  assertLocalDay(day);
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  return { year, month, day: dayOfMonth };
}

/**
 * Which calendar day an instant falls on, for a given time zone.
 *
 * This is the single conversion the whole feature rests on. The same instant
 * is a different local day depending on the zone, which is exactly the point:
 *
 *   toLocalDay(new Date('2026-03-11T21:30Z'), 'Asia/Kolkata') === '2026-03-12'
 *   toLocalDay(new Date('2026-03-11T21:30Z'), 'UTC')          === '2026-03-11'
 */
export function toLocalDay(instant: Date, timeZone: string): LocalDay {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError('Cannot convert an invalid Date to a local day');
  }
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError(`Not a valid IANA time zone: "${timeZone}"`);
  }

  const parts = formatterFor(timeZone).formatToParts(instant);
  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  // Read the parts by name rather than by position, so the locale's field
  // order can never change the result.
  return `${lookup('year').padStart(4, '0')}-${lookup('month')}-${lookup('day')}`;
}

/** The user's today. `now` is injectable so tests never depend on the clock. */
export function todayIn(timeZone: string, now: Date = new Date()): LocalDay {
  return toLocalDay(now, timeZone);
}

/**
 * Moves a calendar date by whole days.
 *
 * The arithmetic runs in UTC on purpose. UTC has no daylight saving, so adding
 * 86,400,000 ms always lands on the next calendar square — which is the
 * behaviour a calendar needs, not the behaviour a clock has.
 */
export function addLocalDays(day: LocalDay, amount: number): LocalDay {
  if (!Number.isInteger(amount)) {
    throw new RangeError(`Can only add whole days, received ${amount}`);
  }

  const { year, month, day: dayOfMonth } = parseLocalDay(day);
  const shifted = new Date(
    utcMillisFor(year, month, dayOfMonth) + amount * MILLISECONDS_PER_DAY
  );
  return toLocalDay(shifted, 'UTC');
}

/** How many days `later` is after `earlier`. Negative when it is before. */
export function differenceInLocalDays(later: LocalDay, earlier: LocalDay): number {
  const a = parseLocalDay(later);
  const b = parseLocalDay(earlier);
  const millis =
    utcMillisFor(a.year, a.month, a.day) - utcMillisFor(b.year, b.month, b.day);
  return Math.round(millis / MILLISECONDS_PER_DAY);
}

/** Sort comparator: -1, 0 or 1. ISO dates compare correctly as plain strings. */
export function compareLocalDays(a: LocalDay, b: LocalDay): number {
  assertLocalDay(a);
  assertLocalDay(b);
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
