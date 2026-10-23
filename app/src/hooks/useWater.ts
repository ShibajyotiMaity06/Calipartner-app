import { useCallback, useEffect, useState } from 'react';
import type { WaterLog } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
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
  const { user } = useAuth();

  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [totalMl, setTotalMl] = useState(0);
  const [loading, setLoading] = useState(true);

  const goalMl = currentGoalProfile?.water_ml_goal ?? 2000;
  const effectiveUserId = user?.id ?? currentGoalProfile?.user_id ?? 'guest-user';

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const db = await getDb();
      let [fetchedLogs, sum] = await Promise.all([
        getWaterLogsForDate(db, effectiveUserId, localDate),
        getWaterTotalForDate(db, effectiveUserId, localDate),
      ]);

      if (fetchedLogs.length === 0 && effectiveUserId !== 'guest-user') {
        const [guestLogs, guestSum] = await Promise.all([
          getWaterLogsForDate(db, 'guest-user', localDate),
          getWaterTotalForDate(db, 'guest-user', localDate),
        ]);
        if (guestLogs.length > 0) {
          fetchedLogs = guestLogs;
          sum = guestSum;
        }
      }

      setLogs(fetchedLogs);
      setTotalMl(sum);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, localDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const addWater = async (amountMl: number): Promise<WaterLog> => {
    const db = await getDb();
    const created = await logWater(db, effectiveUserId, amountMl, localDate);
    await loadData();
    return created;
  };

  const undoLast = async (): Promise<WaterLog | null> => {
    const db = await getDb();
    const undone = await undoLastWaterLog(db, effectiveUserId, localDate);
    await loadData();
    return undone;
  };

  const deleteLog = async (id: string): Promise<WaterLog | null> => {
    const db = await getDb();
    const deleted = await deleteWaterLog(db, effectiveUserId, id);
    await loadData();
    return deleted;
  };

  const editLog = async (id: string, amountMl: number): Promise<WaterLog | null> => {
    const db = await getDb();
    const edited = await editWaterLog(db, effectiveUserId, id, amountMl);
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
