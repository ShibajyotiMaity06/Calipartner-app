import { expect, it, vi } from 'vitest';
import type { Food } from '@calipartner/core';
import {
  clearFoodSearchHistory,
  loadFoodLibrary,
  recordFoodSearch,
  setFoodFavorite,
  type FoodLibraryClient,
} from './foodLibraryService';
const food = { id: 'food', source: 'usda', name: 'Lentils', brand: null, barcode: null } as Food;
function client() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
    rpc: vi.fn(),
  } as FoodLibraryClient & { rpc: ReturnType<typeof vi.fn> };
}
it('requires an acknowledged favourite state and reuses its stable natural key on retry', async () => {
  const api = client();
  api.rpc
    .mockResolvedValueOnce({ data: null, error: null })
    .mockResolvedValue({ data: { food_key: 'usda:lentils:', favorite: true }, error: null });
  await expect(setFoodFavorite('owner', food, true, api)).rejects.toThrow('SAVE_UNCONFIRMED');
  await setFoodFavorite('owner', food, true, api);
  expect(api.rpc.mock.calls[0]).toEqual(api.rpc.mock.calls[1]);
});
it('never reads or writes another signed-in account', async () => {
  const api = client();
  await expect(loadFoodLibrary('other', api)).rejects.toThrow('ACCOUNT_CHANGED');
  expect(api.rpc).not.toHaveBeenCalled();
});
it('clears only after acknowledgement and canonicalizes remembered queries', async () => {
  const api = client();
  api.rpc
    .mockResolvedValueOnce({ data: { query: 'lentils' }, error: null })
    .mockResolvedValueOnce({ data: null, error: null })
    .mockResolvedValueOnce({ data: { cleared: true }, error: null });
  expect(await recordFoodSearch('owner', '  Lentils  ', api)).toBe('lentils');
  await expect(clearFoodSearchHistory('owner', api)).rejects.toThrow('SAVE_UNCONFIRMED');
  await clearFoodSearchHistory('owner', api);
  expect(api.rpc).toHaveBeenLastCalledWith('clear_food_search_history', undefined);
});
