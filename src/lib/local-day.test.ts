import { describe, expect, it } from 'vitest';
import {
  addLocalDays,
  compareLocalDays,
  differenceInLocalDays,
  isLocalDay,
  isValidTimeZone,
  parseLocalDay,
  toLocalDay,
  todayIn,
} from './local-day';

describe('toLocalDay', () => {
  // The worked example from the brief, in Asia/Kolkata (UTC+05:30).
  it('maps the brief’s four instants onto three local days', () => {
    const zone = 'Asia/Kolkata';

    // A: 14:30Z -> 20:00 local
    expect(toLocalDay(new Date('2026-03-10T14:30:00Z'), zone)).toBe('2026-03-10');
    // B: 10:30Z -> 16:00 local. 20 hours after A, but a new day.
    expect(toLocalDay(new Date('2026-03-11T10:30:00Z'), zone)).toBe('2026-03-11');
    // C: 21:30Z -> 03:00 local next day. Only 11 hours after B, still a new day.
    expect(toLocalDay(new Date('2026-03-11T21:30:00Z'), zone)).toBe('2026-03-12');
    // D: 17:30Z -> 23:00 local. 20 hours after C, but the SAME day as C.
    expect(toLocalDay(new Date('2026-03-12T17:30:00Z'), zone)).toBe('2026-03-12');
  });

  it('gives one instant different calendar days in different zones', () => {
    const instant = new Date('2026-03-10T10:30:00Z');

    expect(toLocalDay(instant, 'Pacific/Kiritimati')).toBe('2026-03-11'); // UTC+14
    expect(toLocalDay(instant, 'UTC')).toBe('2026-03-10');
    expect(toLocalDay(instant, 'Pacific/Niue')).toBe('2026-03-09'); // UTC-11
  });

  it('keeps both sides of a spring-forward on the same local day', () => {
    // New York loses an hour at 2026-03-08 02:00 local (07:00Z).
    const zone = 'America/New_York';

    expect(toLocalDay(new Date('2026-03-08T06:30:00Z'), zone)).toBe('2026-03-08'); // 01:30 EST
    expect(toLocalDay(new Date('2026-03-08T07:30:00Z'), zone)).toBe('2026-03-08'); // 03:30 EDT
  });

  it('keeps both sides of a fall-back on the same local day', () => {
    // 01:30 local happens twice on 2026-11-01 in New York.
    const zone = 'America/New_York';

    expect(toLocalDay(new Date('2026-11-01T05:30:00Z'), zone)).toBe('2026-11-01'); // 01:30 EDT
    expect(toLocalDay(new Date('2026-11-01T06:30:00Z'), zone)).toBe('2026-11-01'); // 01:30 EST
  });

  it('handles a half-hour zone at the midnight boundary', () => {
    expect(toLocalDay(new Date('2026-03-11T18:29:59Z'), 'Asia/Kolkata')).toBe(
      '2026-03-11'
    );
    expect(toLocalDay(new Date('2026-03-11T18:30:00Z'), 'Asia/Kolkata')).toBe(
      '2026-03-12'
    );
  });

  it('rejects an invalid instant or zone', () => {
    expect(() => toLocalDay(new Date('nonsense'), 'UTC')).toThrow(RangeError);
    expect(() => toLocalDay(new Date('2026-03-10T00:00:00Z'), 'Mars/Olympus')).toThrow(
      RangeError
    );
  });
});

describe('todayIn', () => {
  it('reads today from the injected clock, not the machine clock', () => {
    const now = new Date('2026-03-11T21:30:00Z');

    expect(todayIn('Asia/Kolkata', now)).toBe('2026-03-12');
    expect(todayIn('UTC', now)).toBe('2026-03-11');
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA zone IDs', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('Asia/Calcutta')).toBe(true); // the canonical alias
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('America/Argentina/Buenos_Aires')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
  });

  it('rejects ambiguous abbreviations that Intl would happily guess at', () => {
    // Left to itself, Intl resolves 'IST' to Asia/Calcutta and 'EST' to
    // America/Panama. 'IST' is also Irish and Israel time, so a guess here
    // would silently file a user's check-ins under the wrong calendar.
    expect(isValidTimeZone('IST')).toBe(false);
    expect(isValidTimeZone('EST')).toBe(false);
    expect(isValidTimeZone('GMT')).toBe(false);
  });

  it('rejects unresolvable or empty input', () => {
    expect(isValidTimeZone('Asia/Nowhere')).toBe(false);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});

describe('isLocalDay', () => {
  it('accepts real calendar dates', () => {
    expect(isLocalDay('2026-03-12')).toBe(true);
    expect(isLocalDay('2028-02-29')).toBe(true); // leap year
  });

  it('rejects malformed or impossible dates', () => {
    expect(isLocalDay('2026-02-30')).toBe(false);
    expect(isLocalDay('2026-13-01')).toBe(false);
    expect(isLocalDay('2026-3-1')).toBe(false);
    expect(isLocalDay('2026-02-29')).toBe(false); // 2026 is not a leap year
    expect(isLocalDay('12-03-2026')).toBe(false);
    expect(isLocalDay('')).toBe(false);
  });
});

describe('parseLocalDay', () => {
  it('splits into 1-indexed month parts', () => {
    expect(parseLocalDay('2026-03-12')).toEqual({ year: 2026, month: 3, day: 12 });
  });

  it('throws on a day it cannot parse', () => {
    expect(() => parseLocalDay('2026-02-30')).toThrow(RangeError);
  });
});

describe('addLocalDays', () => {
  it('moves across month, year and leap boundaries', () => {
    expect(addLocalDays('2026-03-12', 1)).toBe('2026-03-13');
    expect(addLocalDays('2026-03-12', -1)).toBe('2026-03-11');
    expect(addLocalDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addLocalDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addLocalDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addLocalDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addLocalDays('2026-03-12', 0)).toBe('2026-03-12');
  });

  it('treats a daylight-saving day as exactly one day', () => {
    // 2026-03-08 is 23 hours long in New York, and 2026-11-01 is 25.
    expect(addLocalDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addLocalDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addLocalDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addLocalDays('2026-11-01', 1)).toBe('2026-11-02');
  });
});

describe('differenceInLocalDays', () => {
  it('counts whole calendar days in either direction', () => {
    expect(differenceInLocalDays('2026-03-12', '2026-03-11')).toBe(1);
    expect(differenceInLocalDays('2026-03-11', '2026-03-12')).toBe(-1);
    expect(differenceInLocalDays('2026-03-12', '2026-03-12')).toBe(0);
    expect(differenceInLocalDays('2027-01-01', '2026-01-01')).toBe(365);
  });

  it('is not thrown off by daylight-saving days', () => {
    expect(differenceInLocalDays('2026-03-09', '2026-03-07')).toBe(2);
    expect(differenceInLocalDays('2026-11-02', '2026-10-31')).toBe(2);
  });
});

describe('compareLocalDays', () => {
  it('sorts chronologically', () => {
    expect(compareLocalDays('2026-03-11', '2026-03-12')).toBe(-1);
    expect(compareLocalDays('2026-03-12', '2026-03-11')).toBe(1);
    expect(compareLocalDays('2026-03-12', '2026-03-12')).toBe(0);
    expect(['2026-12-01', '2026-03-12', '2026-03-02'].sort(compareLocalDays)).toEqual([
      '2026-03-02',
      '2026-03-12',
      '2026-12-01',
    ]);
  });
});

describe('machine independence', () => {
  it('does not depend on the process time zone', () => {
    // The library is only trustworthy if a server in Mumbai and a server in
    // New York agree. Nothing here reads the ambient zone.
    const instant = new Date('2026-03-11T21:30:00Z');
    const original = process.env.TZ;

    try {
      for (const hostZone of ['UTC', 'Pacific/Kiritimati', 'Pacific/Niue']) {
        process.env.TZ = hostZone;
        expect(toLocalDay(instant, 'Asia/Kolkata')).toBe('2026-03-12');
        expect(addLocalDays('2026-03-12', -1)).toBe('2026-03-11');
        expect(differenceInLocalDays('2026-03-12', '2026-03-11')).toBe(1);
      }
    } finally {
      process.env.TZ = original;
    }
  });
});

describe('boundaries the maths must not round off', () => {
  it('always formats in the Gregorian calendar', () => {
    // Dropping the pinned 'en-US' locale would leave every other test green
    // while returning Buddhist years under th-TH and Islamic years under ar-SA.
    expect(toLocalDay(new Date('2026-03-12T00:00:00Z'), 'UTC')).toBe('2026-03-12');
    expect(
      new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' }).resolvedOptions().calendar
    ).toBe('gregory');
  });

  it('stops at year 1, which is the last year it can print back correctly', () => {
    // The formatter has no era field, so year 0 would render as "1".
    expect(isLocalDay('0001-01-01')).toBe(true);
    expect(isLocalDay('0000-01-01')).toBe(false);
  });

  it('handles years below 100 without folding them into the 1900s', () => {
    // `Date.UTC(99, ...)` means 1999, so a naive implementation produces a day
    // it then refuses to parse.
    expect(addLocalDays('0100-01-01', -1)).toBe('0099-12-31');
    expect(isLocalDay('0099-12-31')).toBe(true);
    expect(differenceInLocalDays('0100-01-01', '0099-12-31')).toBe(1);
  });

  it('only moves by whole days', () => {
    expect(() => addLocalDays('2026-03-12', 0.5)).toThrow(RangeError);
    expect(() => addLocalDays('2026-03-12', Number.NaN)).toThrow(RangeError);
  });
});
