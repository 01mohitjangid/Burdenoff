'use client';

import { useSyncExternalStore } from 'react';
import { listTimeZones } from '@/lib/time-zones';

/** Every time zone the picker may offer. See `useDetectedTimeZone` for why. */
const neverChanges = () => () => {};
const SERVER_ZONES = ['UTC'];

let cached: string[] | null = null;
const readZones = () => (cached ??= listTimeZones());
const readServerZones = () => SERVER_ZONES;

export function useTimeZones(): string[] {
  return useSyncExternalStore(neverChanges, readZones, readServerZones);
}
