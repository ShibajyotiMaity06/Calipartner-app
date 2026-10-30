import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
import { useBrowserModalBack } from './useBrowserModalBack';
let tree: ReactTestRenderer;
let entries: Record<string, unknown>[];
let listeners: Set<() => void>;
let position: number;
const history = {
  get state() {
    return entries[position]!;
  },
  pushState(state: Record<string, unknown>) {
    entries = entries.slice(0, position + 1);
    entries.push(state);
    position++;
  },
  go(delta: number) {
    position = Math.max(0, position + delta);
    for (const listener of listeners) listener();
  },
};
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  entries = [{ router: 'room' }];
  position = 0;
  listeners = new Set();
  vi.stubGlobal('window', {
    history,
    addEventListener: (_type: string, callback: () => void) => listeners.add(callback),
    removeEventListener: (_type: string, callback: () => void) => listeners.delete(callback),
  });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  vi.unstubAllGlobals();
});
function Probe({
  parent = true,
  child = false,
  depth = 0,
  onParent,
  onChild,
  onDepth = vi.fn(),
}: {
  parent?: boolean;
  child?: boolean;
  depth?: number;
  onParent: () => void;
  onChild: () => void;
  onDepth?: (depth: number) => void;
}) {
  useBrowserModalBack(parent, onParent);
  useBrowserModalBack(child, onChild, { depth, onDepthChange: onDepth });
  return null;
}
describe('installed web Back navigation', () => {
  it('closes the child sheet without closing the parent or going home', async () => {
    const parent = vi.fn(),
      child = vi.fn();
    await act(async () => {
      tree = create(<Probe child onParent={parent} onChild={child} />);
    });
    await act(async () => history.go(-1));
    expect(child).toHaveBeenCalledOnce();
    expect(parent).not.toHaveBeenCalled();
    expect(history.state.router).toBe('room');
  });
  it('returns to the previous workout step and removes every step when saving', async () => {
    const parent = vi.fn(),
      child = vi.fn(),
      step = vi.fn();
    await act(async () => {
      tree = create(<Probe child depth={3} onParent={parent} onChild={child} onDepth={step} />);
    });
    expect(position).toBe(5);
    await act(async () => history.go(-1));
    expect(step).toHaveBeenCalledWith(2);
    expect(child).not.toHaveBeenCalled();
    expect(parent).not.toHaveBeenCalled();
    await act(async () =>
      tree.update(<Probe child depth={0} onParent={parent} onChild={child} onDepth={step} />),
    );
    expect(position).toBe(2);
    await act(async () => tree.update(<Probe child={false} onParent={parent} onChild={child} />));
    expect(position).toBe(1);
    expect(parent).not.toHaveBeenCalled();
  });
  it('waits for asynchronous browser history cleanup before immediately reopening a sheet', async () => {
    const parent = vi.fn(),
      child = vi.fn();
    const move = history.go.bind(history);
    const queued: Array<() => void> = [];
    const spy = vi.spyOn(history, 'go').mockImplementation((delta) => {
      queued.push(() => move(delta));
    });
    try {
      await act(async () => {
        tree = create(<Probe child onParent={parent} onChild={child} />);
      });
      await act(async () => tree.update(<Probe child={false} onParent={parent} onChild={child} />));
      await act(async () => tree.update(<Probe child onParent={parent} onChild={child} />));
      expect(position).toBe(2); // a pending back must finish before another push
      await act(async () => queued.shift()!());
      expect(position).toBe(2); // one parent and one newly opened child
      act(() => move(-1));
      expect(child).toHaveBeenCalledOnce();
      expect(parent).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
