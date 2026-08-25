import { useSyncExternalStore } from 'react';

const neverChanges = () => () => {};
const onTheClient = () => true;
const onTheServer = () => false;

/**
 * False during the server render and the first client render, true afterwards.
 *
 * For anything whose value the server cannot know — a theme kept in
 * localStorage, the browser's own time zone — rendering it before hydration
 * would make the two sides disagree. `useSyncExternalStore` says so declaratively
 * and takes a separate server snapshot, rather than setting state in an effect.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(neverChanges, onTheClient, onTheServer);
}
