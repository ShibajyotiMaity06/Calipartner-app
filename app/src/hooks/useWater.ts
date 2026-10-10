import { useCallback, useEffect, useState } from 'react';
import type { WaterLog } from '@calipartner/core';
import { getDb } from '@/db';
import {
  deleteWaterLog,
  editWaterLog,
  getWaterLogsForDate,
  getWaterProgress,
  getWaterTotalForDate,
  logWater,
  undoLastWaterLog,
} from '@/services/waterService';
import { useTargets } from './useTargets';

export interface UseWaterResult {
  logs: WaterLog[];
  totalMl: number;
  goalMl: number;
  progressPercent: number;
  remainingMl: number;
  loading: boolean;
  addWater: (amountMl: number) => Promise<WaterLog>;
  undoLast: () => Promise<WaterLog | null>;
  deleteLog: (id: string) => Promise<WaterLog | null>;
  editLog: (id: string, amountMl: number) => Promise<WaterLog | null>;
  refresh: () => Promise<void>;
}

export function useWater(date?: string): UseWaterResult {
  const localDate = date ?? new Date().toISOString().split('T')[0]!;
  const { currentGoalProfile } = useTargets();

  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [totalMl, setTotalMl] = useState(0);
  const [loading, setLoading] = useState(true);

  const goalMl = currentGoalProfile?.water_ml_goal ?? 2000;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const db = await getDb();
      const userId = currentGoalProfile?.user_id ?? 'guest-user';
      const [fetchedLogs, sum] = await Promise.all([
        getWaterLogsForDate(db, userId, localDate),
        getWaterTotalForDate(db, userId, localDate),
      ]);
      setLogs(fetchedLogs);
      setTotalMl(sum);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, [currentGoalProfile?.user_id, localDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const addWater = async (amountMl: number): Promise<WaterLog> => {
    const db = await getDb();
    const userId = currentGoalProfile?.user_id ?? 'guest-user';
    const created = await logWater(db, userId, amountMl, localDate);
    await loadData();
    return created;
  };

  const undoLast = async (): Promise<WaterLog | null> => {
    const db = await getDb();
    const userId = currentGoalProfile?.user_id ?? 'guest-user';
    const undone = await undoLastWaterLog(db, userId, localDate);
    await loadData();
    return undone;
  };

  const deleteLog = async (id: string): Promise<WaterLog | null> => {
    const db = await getDb();
    const userId = currentGoalProfile?.user_id ?? 'guest-user';
    const deleted = await deleteWaterLog(db, userId, id);
    await loadData();
    return deleted;
  };

  const editLog = async (id: string, amountMl: number): Promise<WaterLog | null> => {
    const db = await getDb();
    const userId = currentGoalProfile?.user_id ?? 'guest-user';
    const edited = await editWaterLog(db, userId, id, amountMl);
    await loadData();
    return edited;
  };

  const { progressPercent, remainingMl } = getWaterProgress(totalMl, goalMl);

  return {
    logs,
    totalMl,
    goalMl,
    progressPercent,
    remainingMl,
    loading,
    addWater,
    undoLast,
    deleteLog,
    editLog,
    refresh: loadData,
  };
}
