let check: (() => Promise<boolean>) | null = null;

export function registerAccountSyncCheck(callback: () => Promise<boolean>): () => void {
  check = callback;
  return () => {
    if (check === callback) check = null;
  };
}

/** An app-level reset check finishes before a queue is read or old data can be uploaded. */
export function beforeTrackingSync(): Promise<boolean> {
  return check ? check() : Promise.resolve(false);
}
