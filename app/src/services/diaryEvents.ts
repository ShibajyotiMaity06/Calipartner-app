import { invalidateReadCache } from './readCache';
type Listener = () => void;

const listeners = new Set<Listener>();

export const diaryEvents = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  emitChange(): void {
    invalidateReadCache('squad');
    invalidateReadCache('progress:');
    invalidateReadCache('tracking-preferences:');
    invalidateReadCache('chat:');
    invalidateReadCache('rooms');
    invalidateReadCache('room-snapshot:');

    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // Ignore listener error
      }
    }
  },
};
