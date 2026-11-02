let check: (() => Promise<boolean>) | null = null;

export function registerAccountWriteCheck(callback: () => Promise<boolean>): () => void {
  check = callback;
  return () => {
    if (check === callback) check = null;
  };
}

/** An app-level reset check finishes before account data can be changed. */
export function beforeAccountWrite(): Promise<boolean> {
  return check ? check() : Promise.resolve(false);
}
