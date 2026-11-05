import { useCallback, useEffect, useRef, useState } from 'react';
import { foodFavoriteKey, type Food } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import {
  clearFoodSearchHistory,
  clearRecentFoods,
  loadFoodLibrary,
  recordFoodSearch,
  setFoodFavorite,
  type FoodLibrary,
} from '@/services/foodLibraryService';
import { generateClientUuid } from '@/services/foodService';
import { diaryEvents } from '@/services/diaryEvents';
export function useFoodLibrary() {
  const { user } = useAuth();
  const id = user?.id;
  const recentClear = useRef<{ owner: string; id: string } | null>(null);
  const owner = useRef(id);
  owner.current = id;
  const version = useRef(0),
    acting = useRef(false);
  const [data, setData] = useState<FoodLibrary>({ foods: [], searches: [] });
  const [dataOwner, setDataOwner] = useState<string>();
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const invalidate = useCallback(() => {
    version.current++;
  }, []);
  const refresh = useCallback(async () => {
    const current = ++version.current;
    if (!id) {
      setLoading(false);
      return;
    }
    setError(false);
    try {
      const result = await loadFoodLibrary(id);
      if (owner.current === id && current === version.current) {
        setData(result);
        setDataOwner(id);
      }
    } catch {
      if (owner.current === id && current === version.current) setError(true);
    } finally {
      if (owner.current === id && current === version.current) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    setLoading(true);
    setBusy(false);
    setData({ foods: [], searches: [] });
    void refresh();
    return invalidate;
  }, [refresh, invalidate]);
  const perform = async (
    operation: (actor: string) => Promise<void>,
    update: (current: FoodLibrary) => FoodLibrary,
  ) => {
    if (!id || acting.current) return false;
    acting.current = true;
    setBusy(true);
    setError(false);
    try {
      await operation(id);
      if (owner.current !== id) return false;
      version.current++;
      setData(update);
      setDataOwner(id);
      return true;
    } catch {
      if (owner.current === id) setError(true);
      return false;
    } finally {
      acting.current = false;
      if (owner.current === id) {
        setBusy(false);
        setLoading(false);
      }
    }
  };
  return {
    ...(dataOwner === id ? data : { foods: [], searches: [] }),
    loading,
    busy,
    error,
    refresh,
    isFavorite: (food: Food) =>
      dataOwner === id &&
      data.foods.some((saved) => foodFavoriteKey(saved) === foodFavoriteKey(food)),
    favorite: (food: Food, favorite: boolean) =>
      perform(
        (actor) => setFoodFavorite(actor, food, favorite),
        (current) => ({
          ...current,
          foods: [
            ...(favorite ? [food] : []),
            ...current.foods.filter((saved) => foodFavoriteKey(saved) !== foodFavoriteKey(food)),
          ],
        }),
      ),
    remember: (query: string) =>
      query.trim().length < 2
        ? Promise.resolve(true)
        : perform(
            async (actor) => {
              await recordFoodSearch(actor, query);
            },
            (current) => ({
              ...current,
              searches: [
                query.trim().toLowerCase(),
                ...current.searches.filter((item) => item !== query.trim().toLowerCase()),
              ].slice(0, 20),
            }),
          ),
    clearHistory: () =>
      perform(clearFoodSearchHistory, (current) => ({ ...current, searches: [] })),
    clearRecentFoods: async () => {
      if (!id) return false;
      if (recentClear.current?.owner !== id)
        recentClear.current = { owner: id, id: generateClientUuid() };
      const requestId = recentClear.current.id;
      let clearedAt: string | undefined;
      const saved = await perform(
        async (actor) => {
          clearedAt = await clearRecentFoods(actor, requestId);
        },
        (current) => ({ ...current, recentFoodsClearedAt: clearedAt }),
      );
      if (saved) {
        recentClear.current = null;
        diaryEvents.emitChange();
      }
      return saved;
    },
  };
}
