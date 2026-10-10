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
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // Ignore listener error
      }
    }
  },
};
