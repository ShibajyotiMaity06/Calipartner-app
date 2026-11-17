import { invalidateReadCache } from './readCache';
// Invalidate every mounted inbox after an acknowledged request action.
const listeners = new Set<() => void>();
export function subscribeRequestInbox(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function invalidateRequestInboxes(): void {
  invalidateReadCache('rooms');
  invalidateReadCache('room-snapshot:');
  invalidateReadCache('squad');

  for (const listener of listeners) listener();
}
