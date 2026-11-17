import { invalidateReadCache } from './readCache';
const listeners = new Set<() => void>();
export const workoutEvents = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  emitChange() {
    invalidateReadCache('workout-plan:');
    invalidateReadCache('weekly-plan:');
    invalidateReadCache('progress:');

    for (const listener of listeners) {
      try {
        listener();
      } catch {
        /* A view cannot invalidate an acknowledged save. */
      }
    }
  },
};
