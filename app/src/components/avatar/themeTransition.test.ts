import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerThemeReveal, transitionTheme, type ThemeReveal } from './themeTransition';
import { themePalettes } from '@calipartner/ui/tokens';

afterEach(() => vi.useRealTimers());
describe('native theme reveal', () => {
  it('starts at the switch center, uses the brown palette and commits only once', () => {
    let request: ThemeReveal | undefined;
    const unregister = registerThemeReveal((value) => {
      request = value;
    });
    const apply = vi.fn();
    const node = {
      measureInWindow: (callback: (...values: number[]) => void) => callback(20, 60, 64, 44),
    };
    transitionTheme(node, apply, false, themePalettes.yellow.bg0);
    expect(request).toMatchObject({ x: 52, y: 82, color: themePalettes.yellow.bg0 });
    expect(apply).not.toHaveBeenCalled();
    const duplicate = vi.fn();
    transitionTheme(node, duplicate, false, themePalettes.light.bg0);
    expect(duplicate).not.toHaveBeenCalled();
    request?.finish();
    request?.finish();
    expect(apply).toHaveBeenCalledOnce();
    unregister();
  });
  it('switches immediately with reduced motion or no mounted overlay', () => {
    const listener = vi.fn();
    const unregister = registerThemeReveal(listener);
    const apply = vi.fn();
    transitionTheme(null, apply, true, themePalettes.yellow.bg0);
    expect(listener).not.toHaveBeenCalled();
    unregister();
    transitionTheme(null, apply, false, themePalettes.light.bg0);
    expect(apply).toHaveBeenCalledTimes(2);
  });
  it('recovers when a detached native view does not answer measurement', () => {
    vi.useFakeTimers();
    const unregister = registerThemeReveal(vi.fn());
    const apply = vi.fn();
    transitionTheme({ measureInWindow: vi.fn() }, apply, false, themePalettes.yellow.bg0);
    vi.advanceTimersByTime(300);
    expect(apply).toHaveBeenCalledOnce();
    unregister();
  });
});
