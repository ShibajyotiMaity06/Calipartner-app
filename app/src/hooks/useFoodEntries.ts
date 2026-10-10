import { useState } from 'react';
import type {
  CreateFoodInput,
  EntrySource,
  Food,
  FoodEntry,
  MealSection,
  UpdateFoodEntryInput,
  UpdateFoodInput,
} from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getSupabase } from '@/lib/supabase';
import { diaryEvents } from '@/services/diaryEvents';
import {
  copyEntireDay,
  copyMealSection,
  deleteFoodEntry,
  editFoodEntry,
  logFoodEntry,
  saveCustomFood,
} from '@/services/foodService';
import { flushOutbox } from '@/services/syncService';

export function useAddEntry() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addEntry = async (params: {
    food: Food;
    quantity: number;
    unit: string;
    mealSection?: MealSection;
    localDate?: string;
    source?: EntrySource;
    sharedMealId?: string | null;
  }): Promise<FoodEntry | null> => {
    try {
      setLoading(true);
      setError(null);
      const db = await getDb();
      const userId = user?.id || 'guest-user';

      const entry = await logFoodEntry(db, {
        userId,
        food: params.food,
        quantity: params.quantity,
        unit: params.unit,
        mealSection: params.mealSection,
        localDate: params.localDate,
        source: params.source,
        sharedMealId: params.sharedMealId,
      });

      diaryEvents.emitChange();

      // Trigger sync if online
      if (isOnline && user?.id) {
        void flushOutbox(db, getSupabase()).catch(() => {});
      }

      return entry;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add entry';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { addEntry, loading, error };
}

export function useEditEntry() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editEntry = async (
    entryId: string,
    updates: UpdateFoodEntryInput,
    food?: Food | null,
  ): Promise<FoodEntry | null> => {
    try {
      setLoading(true);
      setError(null);
      const db = await getDb();
      const entry = await editFoodEntry(db, entryId, updates, food);

      diaryEvents.emitChange();

      if (isOnline && user?.id) {
        void flushOutbox(db, getSupabase()).catch(() => {});
      }

      return entry;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to edit entry';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { editEntry, loading, error };
}

export function useDeleteEntry() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const removeEntry = async (entryId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const db = await getDb();
      const success = await deleteFoodEntry(db, entryId);

      diaryEvents.emitChange();

      if (isOnline && user?.id) {
        void flushOutbox(db, getSupabase()).catch(() => {});
      }

      return success;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete entry';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { deleteEntry: removeEntry, loading, error };
}

export function useCopyMeal() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [loading, setLoading] = useState(false);

  const copyMeal = async (
    sourceDate: string,
    sourceSection: MealSection,
    targetDate: string,
    targetSection?: MealSection,
  ): Promise<FoodEntry[]> => {
    setLoading(true);
    try {
      const db = await getDb();
      const userId = user?.id || 'guest-user';
      const copied = await copyMealSection(db, userId, sourceDate, sourceSection, targetDate, targetSection);
      diaryEvents.emitChange();

      if (isOnline && user?.id) {
        void flushOutbox(db, getSupabase()).catch(() => {});
      }
      return copied;
    } finally {
      setLoading(false);
    }
  };

  const copyDay = async (sourceDate: string, targetDate: string): Promise<FoodEntry[]> => {
    setLoading(true);
    try {
      const db = await getDb();
      const userId = user?.id || 'guest-user';
      const copied = await copyEntireDay(db, userId, sourceDate, targetDate);
      diaryEvents.emitChange();

      if (isOnline && user?.id) {
        void flushOutbox(db, getSupabase()).catch(() => {});
      }
      return copied;
    } finally {
      setLoading(false);
    }
  };

  return { copyMeal, copyDay, loading };
}

export function useCustomFood() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [loading, setLoading] = useState(false);

  const createFood = async (
    input: CreateFoodInput | (UpdateFoodInput & { id: string }),
  ): Promise<Food | null> => {
    setLoading(true);
    try {
      const db = await getDb();
      const userId = user?.id || 'guest-user';
      const food = await saveCustomFood(db, userId, input);
      diaryEvents.emitChange();

      if (isOnline && user?.id) {
        void flushOutbox(db, getSupabase()).catch(() => {});
      }
      return food;
    } finally {
      setLoading(false);
    }
  };

  return { createFood, loading };
}
