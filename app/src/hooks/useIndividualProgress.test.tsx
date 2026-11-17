import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ read: vi.fn(), owner: 'first' }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: state.owner } } }),
}));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
vi.mock('@/services/progressService', () => ({
  fetchIndividualProgress: state.read,
  ProgressServiceError: class extends Error {},
  parseProgressError: (err: unknown) => err,
}));
import { useIndividualProgress } from './useIndividualProgress';
let tree: ReactTestRenderer, current: ReturnType<typeof useIndividualProgress>;
function Probe() {
  current = useIndividualProgress();
  return null;
}
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('ignores delayed ranges and clears a previous account before its next read resolves', async () => {
  let finish!: (value: unknown) => void;
  state.read
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue({ range: '7d' });
  await act(async () => {
    tree = create(<Probe />);
  });
  await act(async () => current.setRange('7d'));
  expect(current.data?.range).toBe('7d');
  await act(async () => finish({ range: '30d' }));
  expect(current.data?.range).toBe('7d');
  state.owner = 'second';
  state.read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => tree.update(<Probe />));
  expect(current.data).toBeNull();
  expect(current.loading).toBe(true);
  await act(async () => finish({ range: '7d', owner: 'second' }));
  expect(current.data).toMatchObject({ owner: 'second' });
});
