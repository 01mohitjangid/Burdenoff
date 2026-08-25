'use client';

import { useSyncExternalStore } from 'react';
import { guessTimeZone } from '@/lib/time-zones';

/**
 * The browser's own time zone, as a suggestion for the signup picker.
 *
 * A client component is still rendered once on the server, where `Intl` reports
 * the HOST's zone rather than the visitor's. Reading it during render would make
 * the two sides disagree and trip a hydration mismatch, so the server gets its
 * own snapshot and the real value arrives after hydration.
 */
const neverChanges = () => () => {};
const SERVER_GUESS = 'UTC';

// The snapshot must be referentially stable or React re-renders forever.
// Client-only: never call this from a server path, or request one's answer
// would be cached for the whole process.
let cached: string | null = null;
const readGuess = () => (cached ??= guessTimeZone());
const readServerGuess = () => SERVER_GUESS;

export function useDetectedTimeZone(): string {
  return useSyncExternalStore(neverChanges, readGuess, readServerGuess);
}
