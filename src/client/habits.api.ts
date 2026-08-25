import 'client-only';
import type { CheckInResponse, HabitResponse } from '@/lib/api-contract';
import type { CreateHabitInput, UpdateHabitInput } from '@/lib/validation/habit';
import { request } from './api-client';

export function createHabit(input: CreateHabitInput): Promise<HabitResponse> {
  return request<HabitResponse>('/api/habits', { method: 'POST', body: input });
}

export function updateHabit(id: string, input: UpdateHabitInput): Promise<HabitResponse> {
  return request<HabitResponse>(`/api/habits/${id}`, { method: 'PATCH', body: input });
}

export function deleteHabit(id: string): Promise<void> {
  return request<void>(`/api/habits/${id}`, { method: 'DELETE' });
}

/**
 * Records a check-in for today.
 *
 * Today is deliberately not sent. The browser's clock and time zone are the two
 * things a user can change most easily, so the server decides which day it is.
 */
export function checkInToday(habitId: string): Promise<CheckInResponse> {
  return request<CheckInResponse>(`/api/habits/${habitId}/check-ins`, { method: 'POST' });
}

/**
 * Records a check-in for a past day.
 *
 * Separate from `checkInToday` on purpose. One function taking an optional day
 * would read an empty form field as "no day given" and quietly record today —
 * with only the browser's native `required` standing in the way.
 */
export function backfillCheckIn(
  habitId: string,
  localDay: string
): Promise<CheckInResponse> {
  if (!localDay) {
    throw new Error('backfillCheckIn needs a day; use checkInToday for today.');
  }

  return request<CheckInResponse>(`/api/habits/${habitId}/check-ins`, {
    method: 'POST',
    body: { localDay },
  });
}
