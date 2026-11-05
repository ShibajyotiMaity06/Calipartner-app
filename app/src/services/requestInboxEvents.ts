// Invalidate every mounted inbox after an acknowledged request action.
const listeners = new Set<() => void>();
export function subscribeRequestInbox(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function invalidateRequestInboxes(): void {
  for (const listener of listeners) listener();
}
