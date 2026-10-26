import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  zone: 'Asia/Kolkata',
  resume: null as ((status: string) => void) | null,
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { timezone: state.zone } }),
}));
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_: string, fn: typeof state.resume) => {
      state.resume = fn;
      return { remove: vi.fn() };
    },
  },
}));
import { useCurrentLocalDate } from './useCurrentLocalDate';
let renderer: ReactTestRenderer;
let day: string;
function Harness() {
  day = useCurrentLocalDate().localDate;
  return null;
}
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  state.zone = 'Asia/Kolkata';
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  vi.useRealTimers();
});
describe('current local date', () => {
  it('rolls over at the user’s midnight rather than UTC midnight', async () => {
    vi.setSystemTime(new Date('2026-10-26T18:29:59Z'));
    await act(async () => {
      renderer = create(<Harness />);
    });
    expect(day).toBe('2026-10-26');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(day).toBe('2026-10-27');
  });
  it('updates after a closed-app resume and a saved time-zone change', async () => {
    vi.setSystemTime(new Date('2026-10-26T18:29:00Z'));
    await act(async () => {
      renderer = create(<Harness />);
    });
    vi.setSystemTime(new Date('2026-10-27T18:40:00Z'));
    await act(async () => {
      state.resume?.('active');
    });
    expect(day).toBe('2026-10-28');
    state.zone = 'America/New_York';
    await act(async () => renderer.update(<Harness />));
    expect(day).toBe('2026-10-27');
  });
});
