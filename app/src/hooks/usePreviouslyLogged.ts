import { useCallback, useEffect, useState } from 'react';
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
  getPreviouslyLoggedItems,
  hideFoodFromHistory,
} from '@/services/foodService';
import { useAddEntry } from './useFoodEntries';

export type HistorySortOption = 'recent' | 'frequent' | 'alpha';

export interface PreviouslyLoggedItem {
  stats: UserFoodStats;
  food: Food;
}

export function usePreviouslyLogged(initialSection?: MealSection) {
  const { user } = useAuth();
  const userId = user?.id || 'guest-user';
  const { addEntry } = useAddEntry();

  const [allItems, setAllItems] = useState<PreviouslyLoggedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<HistorySortOption>('recent');
  const [sectionFilter, setSectionFilter] = useState<MealSection | undefined>(initialSection);
  const [searchQuery, setSearchQuery] = useState('');

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const db = await getDb();
      const items = await getPreviouslyLoggedItems(db, userId);
      setAllItems(items);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
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
    return addEntry({
      food: item.food,
      quantity: item.stats.last_quantity,
      unit: item.stats.last_unit,
      mealSection: targetSection ?? item.stats.last_meal_section,
      localDate,
      source: 'history',
    });
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
