import { flushSync } from 'react-dom';
import { motion } from '@calipartner/ui';

type Transition = { ready: Promise<void>; finished: Promise<void> };
type ThemeDocument = {
  startViewTransition?: (update: () => void) => Transition;
  documentElement: { animate: (frames: unknown, options: unknown) => unknown };
  getElementById: (id: string) => unknown;
  createElement: (tag: string) => { id: string; textContent: string };
  head: { appendChild: (node: unknown) => void };
};
let running = false;
export function transitionTheme(
  node: unknown,
  apply: () => void,
  reduceMotion: boolean,
  _color: string,
): void {
  const browser = globalThis as unknown as {
    document?: ThemeDocument;
    innerWidth: number;
    innerHeight: number;
  };
  const document = browser.document;
  const button = node as {
    getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
  } | null;
  if (reduceMotion || !document?.startViewTransition || !button?.getBoundingClientRect) {
    apply();
    return;
  }
  if (running) return;
  const rect = button.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const distance = Math.hypot(
    Math.max(x, browser.innerWidth - x),
    Math.max(y, browser.innerHeight - y),
  );
  if (!document.getElementById('calipartner-theme-reveal')) {
    const style = document.createElement('style');
    style.id = 'calipartner-theme-reveal';
    style.textContent =
      '::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}';
    document.head.appendChild(style);
  }
  let applied = false;
  running = true;
  try {
    const transition = document.startViewTransition(() => {
      applied = true;
      flushSync(apply);
    });
    void transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${distance}px at ${x}px ${y}px)`] },
          {
            duration: motion.theme.duration,
            easing: 'ease-in-out',
            pseudoElement: '::view-transition-new(root)',
          },
        );
      })
      .catch(() => {
        if (!applied) apply();
      });
    void transition.finished
      .catch(() => undefined)
      .finally(() => {
        running = false;
      });
  } catch {
    running = false;
    if (!applied) apply();
  }
}
