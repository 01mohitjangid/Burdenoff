import { afterEach, describe, expect, it, vi } from 'vitest';
import { guessTimeZone, listTimeZones } from './time-zones';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('listTimeZones', () => {
  it('drops anything the server would reject', () => {
    // Asserting that every entry passes `isValidTimeZone` would be a tautology:
    // the list is built by filtering on that very function. So inject values it
    // must reject and check they are gone.
    vi.spyOn(Intl, 'supportedValuesOf').mockReturnValue([
      'Asia/Calcutta',
      'IST', // an ambiguous abbreviation
      'EST', // resolves to America/Panama, of all places
      'Japan', // a legacy single-segment alias
      'Mars/Olympus', // right shape, not a real zone — the other half of the check
      '',
    ] as ReturnType<typeof Intl.supportedValuesOf>);

    expect(listTimeZones()).toEqual(['UTC', 'Asia/Calcutta']);
  });

  it('includes UTC, which the runtime list leaves out', () => {
    expect(Intl.supportedValuesOf('timeZone')).not.toContain('UTC');
    expect(listTimeZones()).toContain('UTC');
  });

  it('covers the zones the brief cares about', () => {
    const zones = listTimeZones();
    // Intl reports canonical IDs, so India appears as Asia/Calcutta.
    expect(zones).toContain('Asia/Calcutta');
    expect(zones).toContain('America/New_York');
    expect(zones).toContain('Europe/London');
    expect(zones.length).toBeGreaterThan(100);
  });

  it('has no duplicates', () => {
    const zones = listTimeZones();
    expect(new Set(zones).size).toBe(zones.length);
  });
});

describe('guessTimeZone', () => {
  function pretendBrowserReports(timeZone: string): void {
    // Only `resolvedOptions` is stubbed, never the constructor. Replacing the
    // whole of `Intl.DateTimeFormat` would also disable the `isValidTimeZone`
    // check this test exists to exercise, and the test would then pass for the
    // wrong reason.
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone,
    } as Intl.ResolvedDateTimeFormatOptions);
  }

  it('uses the browser’s zone when it is a real IANA id', () => {
    pretendBrowserReports('Asia/Calcutta');
    expect(guessTimeZone()).toBe('Asia/Calcutta');
  });

  it('falls back to UTC when the runtime reports something unusable', () => {
    // Asserting only that the result is valid would be a tautology, because the
    // fallback guarantees it. Assert the fallback value itself.
    for (const unusable of ['IST', 'EST', '', 'Mars/Olympus']) {
      pretendBrowserReports(unusable);
      expect(guessTimeZone()).toBe('UTC');
    }
  });
});
