/**
 * The shapes that cross the network.
 *
 * This module is pure and imports nothing, so the browser can narrow on an
 * error code without dragging any server module into the client bundle.
 * Server and client both read the contract from here, so it cannot drift.
 */

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_TAKEN'
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'PAYLOAD_TOO_LARGE'
  | 'DUPLICATE_CHECK_IN'
  | 'INTERNAL_ERROR';

/** Field name to the messages that apply to it. */
export type FieldErrors = Record<string, string[]>;

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    fields?: FieldErrors;
  };
}

/** Every column of a user that is safe to send to a browser. */
export interface PublicUser {
  id: string;
  email: string;
  timeZone: string;
}

export interface AuthResponse {
  user: PublicUser;
}

export interface MeResponse {
  user: PublicUser;
  /** The caller's today, as the server computed it. Format `YYYY-MM-DD`. */
  today: string;
}

/** A habit plus the streak numbers the server computed for it. */
export interface HabitSummary {
  id: string;
  name: string;
  description: string | null;
  /** ISO instant the habit was created. */
  createdAt: string;
  /** The earliest local day this habit can be checked in for. */
  startedOn: string;
  currentStreak: number;
  longestStreak: number;
  checkedInToday: boolean;
}

export interface CheckInRecord {
  id: string;
  /** The local day it counts for, `YYYY-MM-DD`. */
  localDay: string;
  /** ISO instant the check-in was recorded. */
  checkedInAt: string;
}

export interface HabitsResponse {
  habits: HabitSummary[];
  /** The caller's today, as the server computed it. */
  today: string;
}

export interface HabitResponse {
  habit: HabitSummary;
  today: string;
}

export interface HabitDetailResponse extends HabitResponse {
  checkIns: CheckInRecord[];
}

export interface CheckInResponse {
  checkIn: CheckInRecord;
  /** The same habit with its streaks recomputed, so the caller need not refetch. */
  habit: HabitSummary;
  today: string;
}
