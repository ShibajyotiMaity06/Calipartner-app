import type { View } from 'react-native';

export type ThemeReveal = { x: number; y: number; color: string; finish: () => void };
let reveal: ((request: ThemeReveal) => void) | undefined;
let running = false;

export function registerThemeReveal(listener: (request: ThemeReveal) => void) {
  reveal = listener;
  return () => {
    if (reveal === listener) reveal = undefined;
  };
}

/** Native screen wash: expand the destination palette, commit, then reveal the content. */
export function transitionTheme(
  node: unknown,
  apply: () => void,
  reduceMotion: boolean,
  color: string,
): void {
  if (running) return;
  const button = node as View | null;
  if (reduceMotion || !reveal || !button?.measureInWindow) {
    apply();
    return;
  }
  running = true;
  let applied = false;
  const finish = () => {
    if (!applied) {
      applied = true;
      apply();
    }
    running = false;
  };
  // A detached native view may never answer measurement.
  const timeout = setTimeout(finish, 250);
  button.measureInWindow((x, y, width, height) => {
    clearTimeout(timeout);
    if (applied) return;
    if (!reveal || !width || !height) {
      finish();
      return;
    }
    reveal({ x: x + width / 2, y: y + height / 2, color, finish });
  });
}
