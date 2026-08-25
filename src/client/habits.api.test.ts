import { afterEach, describe, expect, it, vi } from 'vitest';
import { backfillCheckIn, checkInToday, deleteHabit } from './habits.api';

function respondWith(body: unknown, status = 200): void {
  const response =
    status === 204
      ? new Response(null, { status })
      : new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('checkInToday', () => {
  it('sends no body, so the server decides what today is', async () => {
    // A date sent from here would be the browser's idea of today, which is the
    // one thing a user can change most easily.
    respondWith({ checkIn: {}, habit: {}, today: '2026-03-12' });

    await checkInToday('habit_1');

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/habits/habit_1/check-ins');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeUndefined();
  });
});

describe('backfillCheckIn', () => {
  it('sends the day it was given', async () => {
    respondWith({ checkIn: {}, habit: {}, today: '2026-03-12' });

    await backfillCheckIn('habit_1', '2026-03-11');

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.body).toBe('{"localDay":"2026-03-11"}');
  });

  it('refuses an empty day instead of quietly recording today', () => {
    // This is the whole reason the function is separate from checkInToday. An
    // empty form field must not become "no day given", which the API reads as
    // today.
    vi.stubGlobal('fetch', vi.fn());

    expect(() => backfillCheckIn('habit_1', '')).toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('deleteHabit', () => {
  it('handles the 204 that carries no body', async () => {
    respondWith(null, 204);

    await expect(deleteHabit('habit_1')).resolves.toBeUndefined();
    expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe('DELETE');
  });
});
