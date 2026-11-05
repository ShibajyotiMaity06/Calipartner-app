import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Food } from '@calipartner/core';
const api = vi.hoisted(() => ({
  load: vi.fn(),
  favorite: vi.fn(),
  clear: vi.fn(),
  resetRecent: vi.fn(),
  remember: vi.fn(),
  user: { id: 'owner' },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: api.user }) }));
vi.mock('@/services/foodLibraryService', () => ({
  loadFoodLibrary: api.load,
  setFoodFavorite: api.favorite,
  clearFoodSearchHistory: api.clear,
  clearRecentFoods: api.resetRecent,
  recordFoodSearch: api.remember,
}));
import { useFoodLibrary } from './useFoodLibrary';
it('keeps the same clear-recent-foods UUID after a failed acknowledgement and preserves favourites', async () => {
  api.load.mockResolvedValue({ foods: [food], searches: [], recentFoodsClearedAt: null });
  await act(async () => {
    tree = create(<Probe />);
  });
  api.resetRecent
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue('2026-11-05T01:00:00Z');
  await act(async () => {
    expect(await state.clearRecentFoods()).toBe(false);
  });
  expect(state.recentFoodsClearedAt).toBeNull();
  await act(async () => {
    expect(await state.clearRecentFoods()).toBe(true);
  });
  expect(api.resetRecent.mock.calls[0]).toEqual(api.resetRecent.mock.calls[1]);
  expect(state.foods).toHaveLength(1);
  expect(state.recentFoodsClearedAt).toBe('2026-11-05T01:00:00Z');
});
const food = { id: 'food', source: 'usda', name: 'Lentils', brand: null, barcode: null } as Food;
let state: ReturnType<typeof useFoodLibrary>, tree: ReactTestRenderer;
function Probe() {
  state = useFoodLibrary();
  return null;
}
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  api.user = { id: 'owner' };
  api.load.mockResolvedValue({ foods: [], searches: ['lentils'] });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('shows a favourite only after acknowledgement, retaining it when searches are cleared', async () => {
  await act(async () => {
    tree = create(<Probe />);
  });
  let acknowledge!: () => void;
  api.favorite.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        acknowledge = resolve;
      }),
  );
  let pending!: Promise<boolean>;
  await act(async () => {
    pending = state.favorite(food, true);
  });
  expect(state.isFavorite(food)).toBe(false);
  await act(async () => {
    acknowledge();
    await pending;
  });
  expect(state.isFavorite(food)).toBe(true);
  api.clear.mockResolvedValue(undefined);
  await act(async () => {
    await state.clearHistory();
  });
  expect(state.searches).toEqual([]);
  expect(state.foods).toHaveLength(1);
});
it('keeps data unchanged and exposes an actionable error when a write fails', async () => {
  await act(async () => {
    tree = create(<Probe />);
  });
  api.clear.mockRejectedValue(new Error('offline'));
  await act(async () => {
    expect(await state.clearHistory()).toBe(false);
  });
  expect(state.searches).toEqual(['lentils']);
  expect(state.error).toBe(true);
});
it('never exposes the previous account’s favourites after switching accounts', async () => {
  api.load.mockResolvedValueOnce({ foods: [food], searches: ['lentils'] });
  await act(async () => {
    tree = create(<Probe />);
  });
  api.user = { id: 'other' };
  api.load.mockResolvedValue({ foods: [], searches: [] });
  await act(async () => tree.update(<Probe />));
  expect(state.foods).toEqual([]);
  expect(state.searches).toEqual([]);
});
