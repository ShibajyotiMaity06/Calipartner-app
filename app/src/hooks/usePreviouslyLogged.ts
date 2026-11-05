import { loadAccountTable } from '@/services/accountDataService';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  filterAndSortHistory,
  type Food,
  type MealSection,
  type UserFoodStats,
} from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { diaryEvents } from '@/services/diaryEvents';
import {
  ensureBundledFoodsSeeded,
  getPreviouslyLoggedItems,
  hideFoodFromHistory,
} from '@/services/foodService';
import { useAddEntry } from './useFoodEntries';
import { loadFoodLibrary } from '@/services/foodLibraryService';

export type HistorySortOption = 'recent' | 'frequent' | 'alpha';

export interface PreviouslyLoggedItem {
  stats: UserFoodStats;
  food: Food;
}

export function usePreviouslyLogged(initialSection?: MealSection) {
  const { user } = useAuth();
  const userId = user?.id || 'guest-user';
  const { addEntry, error: saveError, loading: saving } = useAddEntry();
  const adding = useRef(false);
  const owner = useRef(userId);
  owner.current = userId;

  const [allItems, setAllItems] = useState<PreviouslyLoggedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sort, setSort] = useState<HistorySortOption>('recent');
  const [sectionFilter, setSectionFilter] = useState<MealSection | undefined>(initialSection);
  const [searchQuery, setSearchQuery] = useState('');

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const db = await getDb();
      await ensureBundledFoodsSeeded(db);
      await loadAccountTable(db, 'food_entries', userId);
      await loadAccountTable(db, 'user_food_stats', userId);
      await loadAccountTable(db, 'foods', userId);
      const library = userId === 'guest-user' ? null : await loadFoodLibrary(userId);
      const items = await getPreviouslyLoggedItems(db, userId, library?.recentFoodsClearedAt);
      if (owner.current === userId) setAllItems(items);
    } catch {
      if (owner.current === userId) {
        setAllItems([]);
        setError(true);
      }
    } finally {
      if (owner.current === userId) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadHistory();
    const unsub = diaryEvents.subscribe(() => {
      void loadHistory();
    });
    return unsub;
  }, [loadHistory]);

  const filteredItems = filterAndSortHistory(allItems, {
    sort,
    section: sectionFilter,
    query: searchQuery,
  });

  const oneTapAdd = async (
    item: PreviouslyLoggedItem,
    targetSection?: MealSection,
    localDate?: string,
  ) => {
    if (adding.current) return null;
    adding.current = true;
    try {
      return await addEntry({
        food: item.food,
        quantity: item.stats.last_quantity,
        unit: item.stats.last_unit,
        mealSection: targetSection ?? item.stats.last_meal_section,
        localDate,
        source: 'history',
      });
    } finally {
      adding.current = false;
    }
  };

  const removeFromHistory = async (foodId: string) => {
    const db = await getDb();
    await hideFoodFromHistory(db, userId, foodId);
    diaryEvents.emitChange();
  };

  return {
    items: filteredItems,
    allItemsCount: allItems.length,
    loading,
    error,
    saveError,
    saving,
    sort,
    setSort,
    sectionFilter,
    setSectionFilter,
    searchQuery,
    setSearchQuery,
    oneTapAdd,
    removeFromHistory,
    refresh: loadHistory,
  };
}
