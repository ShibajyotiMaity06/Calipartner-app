const listeners = new Set<() => void>();
export const avatarRewardEvents = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  emitChange() {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        /* A listener cannot undo a save. */
      }
    }
  },
};
