import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

interface BrowserWindow {
  history: {
    state: Record<string, unknown> | null;
    pushState(state: unknown, title: string): void;
    go(delta: number): void;
  };
  addEventListener(type: 'popstate', listener: () => void): void;
  removeEventListener(type: 'popstate', listener: () => void): void;
}
const moving = new WeakMap<BrowserWindow, Promise<void>>();
function afterNavigation(browser: BrowserWindow, action: () => void) {
  const pending = moving.get(browser);
  if (pending) void pending.then(action);
  else action();
}
function go(browser: BrowserWindow, delta: number) {
  const pending = new Promise<void>((resolve) => {
    const done = () => {
      browser.removeEventListener('popstate', done);
      moving.delete(browser);
      resolve();
    };
    browser.addEventListener('popstate', done);
  });
  moving.set(browser, pending);
  browser.history.go(delta);
}
function depths(browser: BrowserWindow): Record<string, number> {
  return (browser.history.state?.calipartnerModalDepths ?? {}) as Record<string, number>;
}
function pushDepth(browser: BrowserWindow, key: string, depth: number) {
  browser.history.pushState(
    { ...browser.history.state, calipartnerModalDepths: { ...depths(browser), [key]: depth } },
    '',
  );
}
/** Preserve native-style Back for sheets and their steps in installed web apps. */
export function useBrowserModalBack(
  visible: boolean,
  onClose: () => void,
  options?: { depth: number; onDepthChange: (depth: number) => void },
) {
  const close = useRef(onClose);
  close.current = onClose;
  const currentOptions = useRef(options);
  currentOptions.current = options;
  const ownKey = useRef<string | undefined>(undefined);
  const depth = options?.depth ?? 0;
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const browser = (globalThis as unknown as { window?: BrowserWindow }).window;
    if (!browser) return;
    let current = true;
    const key = `modal-${Date.now()}-${Math.random()}`;
    const pop = () => {
      const active = browser.history.state?.calipartnerModalStack;
      if (!Array.isArray(active) || !active.includes(key)) close.current();
      else if (active.at(-1) === key) {
        const next = depths(browser)[key] ?? 0;
        if (next < (currentOptions.current?.depth ?? 0))
          currentOptions.current?.onDepthChange(next);
      }
    };
    afterNavigation(browser, () => {
      if (!current) return;
      ownKey.current = key;
      const previous = browser.history.state?.calipartnerModalStack;
      const stack = Array.isArray(previous) ? (previous as string[]) : [];
      browser.history.pushState(
        {
          ...browser.history.state,
          calipartnerModalStack: [...stack, key],
          calipartnerModalDepths: { ...depths(browser), [key]: 0 },
        },
        '',
      );
      for (let step = 1; step <= (currentOptions.current?.depth ?? 0); step++)
        pushDepth(browser, key, step);
      browser.addEventListener('popstate', pop);
    });
    return () => {
      current = false;
      browser.removeEventListener('popstate', pop);
      ownKey.current = undefined;
      afterNavigation(browser, () => {
        const active = browser.history.state?.calipartnerModalStack;
        if (!Array.isArray(active) || !active.includes(key)) return;
        const removed = active.slice(active.indexOf(key)) as string[];
        const count = removed.reduce((total, id) => total + (depths(browser)[id] ?? 0) + 1, 0);
        go(browser, -count);
      });
    };
  }, [visible]);
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || !ownKey.current) return;
    const browser = (globalThis as unknown as { window?: BrowserWindow }).window;
    if (!browser) return;
    const key = ownKey.current;
    afterNavigation(browser, () => {
      if (ownKey.current !== key) return;
      const stack = browser.history.state?.calipartnerModalStack;
      if (!Array.isArray(stack) || stack.at(-1) !== key) return;
      const previousDepth = depths(browser)[key] ?? 0;
      const nextDepth = currentOptions.current?.depth ?? 0;
      if (nextDepth < previousDepth) go(browser, nextDepth - previousDepth);
      else
        for (let step = previousDepth + 1; step <= nextDepth; step++) pushDepth(browser, key, step);
    });
  }, [visible, depth]);
}
