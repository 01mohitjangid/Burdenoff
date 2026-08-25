import { isValidTimeZone } from './local-day';

/**
 * The time zones a user may choose at signup.
 *
 * Built from the runtime's own list rather than a hand-written one, then
 * filtered through the same `isValidTimeZone` the server validates with, so the
 * picker cannot offer a value the API would reject.
 *
 * Two consequences worth knowing:
 *
 *   - `Intl` reports canonical IDs, so this list contains `Asia/Calcutta` rather
 *     than its modern alias `Asia/Kolkata`. Both are accepted on the way in.
 *   - `UTC` is not in the runtime's list at all, so it is added explicitly.
 */
export function listTimeZones(): string[] {
  const zones = Intl.supportedValuesOf('timeZone').filter(isValidTimeZone);
  return ['UTC', ...zones];
}

/**
 * The browser's own time zone, to preselect the picker.
 *
 * Only a starting suggestion — the user can change it, and the value is
 * validated on the server either way. Falls back to `UTC` when the runtime
 * reports something the API would not accept.
 */
export function guessTimeZone(): string {
  const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(guess) ? guess : 'UTC';
}
