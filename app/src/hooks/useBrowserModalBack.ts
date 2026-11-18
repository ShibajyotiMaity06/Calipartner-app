import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

type BrowserPopEvent = { stopImmediatePropagation: () => void };
type RouteEntry = { id: string; url: string };

interface BrowserWindow {
  location?: { pathname: string; search?: string; hash?: string };
  history: {
    state: Record<string, unknown> | null;
    pushState(state: unknown, title: string): void;
    go(delta: number): void;
  };
  addEventListener(
    type: 'popstate',
    listener: (event: BrowserPopEvent) => void,
    capture?: boolean,
  ): void;
}

const subscribers = new WeakMap<BrowserWindow, Map<() => void, RouteEntry | undefined>>();
const moving = new WeakMap<BrowserWindow, Promise<void>>();
const closingSyntheticEntry = new WeakSet<BrowserWindow>();

function routeEntry(browser: BrowserWindow): RouteEntry | undefined {
  const { location } = browser;
  const id = browser.history.state?.id;
  if (location && typeof id === 'string')
    return { id, url: location.pathname + (location.search ?? '') + (location.hash ?? '') };
}

function backSubscribers(browser: BrowserWindow) {
  const existing = subscribers.get(browser);
  if (existing) return existing;

  const callbacks = new Map<() => void, RouteEntry | undefined>();
  browser.addEventListener(
    'popstate',
    (event) => {
      const destination = routeEntry(browser);
      // These entries share the router's route ID and URL. Let the modal consume them
      // before Expo Router resets the route and replaces the modal's history state.
      if (
        destination &&
        [...callbacks.values()].some(
          (entry) => entry?.id === destination.id && entry.url === destination.url,
        )
      )
        event?.stopImmediatePropagation();
      for (const callback of [...callbacks.keys()]) callback();
    },
    true,
  );
  subscribers.set(browser, callbacks);
  return callbacks;
}

/** Register ahead of Expo Router's history listener at application startup. */
export function prepareBrowserModalBack() {
  const browser = (globalThis as unknown as { window?: BrowserWindow }).window;
  if (Platform?.OS === 'web' && browser) backSubscribers(browser);
}

function subscribeToBack(browser: BrowserWindow, listener: () => void) {
  const callbacks = backSubscribers(browser);
  callbacks.set(listener, routeEntry(browser));
  return () => callbacks.delete(listener);
}

function afterNavigation(browser: BrowserWindow, action: () => void) {
  const pending = moving.get(browser);
  if (pending) void pending.then(action);
  else action();
}
function go(browser: BrowserWindow, delta: number, syntheticClose = false) {
  if (syntheticClose) closingSyntheticEntry.add(browser);
  const pending = new Promise<void>((resolve) => {
    const unsubscribe = subscribeToBack(browser, () => {
      unsubscribe();
      moving.delete(browser);
      closingSyntheticEntry.delete(browser);
      resolve();
    });
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
/** Finish the active sheet/section history before switching tabs. */
export function closeBrowserModalsThen(navigate: () => void): void {
  if (Platform?.OS !== 'web') {
    navigate();
    return;
  }
  const browser = (globalThis as unknown as { window?: BrowserWindow }).window;
  if (!browser) {
    navigate();
    return;
  }
  afterNavigation(browser, () => {
    const stack = browser.history.state?.calipartnerModalStack;
    if (Array.isArray(stack) && stack.length) {
      const count = (stack as string[]).reduce(
        (total, key) => total + (depths(browser)[key] ?? 0) + 1,
        0,
      );
      go(browser, -count);
      afterNavigation(browser, navigate);
    } else navigate();
  });
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
    if (Platform?.OS !== 'web' || !visible) return;
    const browser = (globalThis as unknown as { window?: BrowserWindow }).window;
    if (!browser) return;
    const routePath = browser.location?.pathname;
    let current = true;
    let entry: RouteEntry | undefined;
    let unsubscribe: (() => void) | undefined;
    const key = `modal-${Date.now()}-${Math.random()}`;
    const pop = () => {
      // Closing a child sheet rewinds its synthetic entry. That programmatic pop
      // must not act as Back on a parent's section when Router replaced its state.
      if (closingSyntheticEntry.has(browser) || browser.location?.pathname !== routePath) return;
      const destination = routeEntry(browser);
      if (entry && destination && (entry.id !== destination.id || entry.url !== destination.url))
        return;
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
      entry = routeEntry(browser);
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
      unsubscribe = subscribeToBack(browser, pop);
    });
    return () => {
      current = false;
      unsubscribe?.();
      ownKey.current = undefined;
      afterNavigation(browser, () => {
        const active = browser.history.state?.calipartnerModalStack;
        if (!Array.isArray(active) || !active.includes(key)) return;
        // A tab change has already navigated. Rewinding here would undo that navigation.
        if (browser.location?.pathname !== routePath) return;
        const removed = active.slice(active.indexOf(key)) as string[];
        const count = removed.reduce((total, id) => total + (depths(browser)[id] ?? 0) + 1, 0);
        go(browser, -count, true);
      });
    };
  }, [visible]);
  useEffect(() => {
    if (!visible || Platform?.OS !== 'web' || !ownKey.current) return;
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
