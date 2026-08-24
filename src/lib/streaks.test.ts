import { describe, expect, it } from 'vitest';
import { toLocalDay } from './local-day';
import { computeStreaks } from './streaks';

describe('computeStreaks', () => {
  it('returns zeros for a habit with no check-ins', () => {
    expect(computeStreaks([], '2026-03-12')).toEqual({
      currentStreak: 0,
      longestStreak: 0,
    });
  });

  it('counts a single check-in today as a streak of one', () => {
    expect(computeStreaks(['2026-03-12'], '2026-03-12')).toEqual({
      currentStreak: 1,
      longestStreak: 1,
    });
  });

  it('keeps the streak alive when only yesterday is logged', () => {
    // Today is not over yet, so an unlogged today does not break anything.
    expect(computeStreaks(['2026-03-10', '2026-03-11'], '2026-03-12')).toEqual({
      currentStreak: 2,
      longestStreak: 2,
    });
  });

  it('kills the current streak once a whole day has been missed', () => {
    expect(computeStreaks(['2026-03-09', '2026-03-10'], '2026-03-12')).toEqual({
      currentStreak: 0,
      longestStreak: 2,
    });
  });

  it('keeps the longest streak after the current one breaks', () => {
    const days = [
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04', // a run of four
      '2026-03-11',
      '2026-03-12', // then a run of two, ending today
    ];

    expect(computeStreaks(days, '2026-03-12')).toEqual({
      currentStreak: 2,
      longestStreak: 4,
    });
  });

  it('does not care what order the days arrive in', () => {
    const shuffled = ['2026-03-12', '2026-03-10', '2026-03-11'];

    expect(computeStreaks(shuffled, '2026-03-12')).toEqual({
      currentStreak: 3,
      longestStreak: 3,
    });
  });

  it('ignores duplicate days', () => {
    const withDuplicates = ['2026-03-11', '2026-03-12', '2026-03-12'];

    expect(computeStreaks(withDuplicates, '2026-03-12')).toEqual({
      currentStreak: 2,
      longestStreak: 2,
    });
  });

  it('ignores days after today', () => {
    const withFuture = ['2026-03-11', '2026-03-12', '2026-03-20'];

    expect(computeStreaks(withFuture, '2026-03-12')).toEqual({
      currentStreak: 2,
      longestStreak: 2,
    });
  });

  it('counts a run that spans a daylight-saving change', () => {
    // 2026-03-08 is only 23 hours long in New York. It is still one day.
    const days = ['2026-03-07', '2026-03-08', '2026-03-09'];

    expect(computeStreaks(days, '2026-03-09')).toEqual({
      currentStreak: 3,
      longestStreak: 3,
    });
  });

  it('counts runs across month, year and leap-day boundaries', () => {
    expect(computeStreaks(['2026-12-31', '2027-01-01'], '2027-01-01')).toEqual({
      currentStreak: 2,
      longestStreak: 2,
    });
    expect(
      computeStreaks(['2028-02-28', '2028-02-29', '2028-03-01'], '2028-03-01')
    ).toEqual({ currentStreak: 3, longestStreak: 3 });
    expect(computeStreaks(['2026-02-28', '2026-03-01'], '2026-03-01')).toEqual({
      currentStreak: 2,
      longestStreak: 2,
    });
  });

  it('rejects a malformed today the same way whether or not there is history', () => {
    // One bad input must not have two behaviours.
    expect(() => computeStreaks([], 'not-a-day')).toThrow(RangeError);
    expect(() => computeStreaks(['2026-03-12'], 'not-a-day')).toThrow(RangeError);
  });

  it('reproduces the worked example from the brief end to end', () => {
    const zone = 'Asia/Kolkata';
    const instants = [
      '2026-03-10T14:30:00Z', // A -> 2026-03-10
      '2026-03-11T10:30:00Z', // B -> 2026-03-11, 20 hours after A
      '2026-03-11T21:30:00Z', // C -> 2026-03-12, 11 hours after B
      '2026-03-12T17:30:00Z', // D -> 2026-03-12, 20 hours after C, a duplicate
    ];

    const localDays = instants.map((instant) => toLocalDay(new Date(instant), zone));
    expect(localDays).toEqual(['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-12']);

    // D is rejected at write time, so only three rows ever exist.
    const stored = localDays.slice(0, 3);
    const today = toLocalDay(new Date('2026-03-12T17:30:00Z'), zone);

    expect(computeStreaks(stored, today)).toEqual({
      currentStreak: 3,
      longestStreak: 3,
    });
  });
});
