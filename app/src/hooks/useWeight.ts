import { useCallback, useEffect, useState } from 'react';
import type { WeightLog, WeightTrendPoint } from '@calipartner/core';
import { getDb } from '@/db';
import {
  deleteWeightLog,
  editWeightLog,
  getWeightLogs,
  getWeightSummary,
  logWeight as logWeightService,
} from '@/services/weightService';
import { useTargets } from './useTargets';

export interface UseWeightResult {
  logs: WeightLog[];
  latestLog: WeightLog | null;
  latestTrendKg: number | null;
  weeklyPaceKg: number | null;
  projectedDate: string | null;
  projectionReason: 'achieved' | 'on_track' | 'not_enough_trend' | 'wrong_direction';
  goalProgressPercent: number;
  trendHistory: WeightTrendPoint[];
  loading: boolean;
  logWeight: (weightKg: number, date?: string, notes?: string) => Promise<WeightLog>;
  editWeight: (id: string, weightKg: number, notes?: string) => Promise<WeightLog | null>;
  deleteWeight: (id: string) => Promise<WeightLog | null>;
  refresh: () => Promise<void>;
}

export function useWeight(): UseWeightResult {
  const { currentGoalProfile } = useTargets();

  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [latestLog, setLatestLog] = useState<WeightLog | null>(null);
  const [latestTrendKg, setLatestTrendKg] = useState<number | null>(null);
  const [weeklyPaceKg, setWeeklyPaceKg] = useState<number | null>(null);
  const [projectedDate, setProjectedDate] = useState<string | null>(null);
  const [projectionReason, setProjectionReason] = useState<
    'achieved' | 'on_track' | 'not_enough_trend' | 'wrong_direction'
  >('not_enough_trend');
  const [goalProgressPercent, setGoalProgressPercent] = useState(0);
  const [trendHistory, setTrendHistory] = useState<WeightTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const db = await getDb();
      const userId = currentGoalProfile?.user_id ?? 'guest-user';

      const [fetchedLogs, summary] = await Promise.all([
        getWeightLogs(db, userId, 100),
        getWeightSummary(db, userId, {
          startingWeightKg: currentGoalProfile?.current_weight_kg,
          targetWeightKg: currentGoalProfile?.target_weight_kg,
        }),
      ]);

      setLogs(fetchedLogs);
      setLatestLog(summary.latestLog);
      setLatestTrendKg(summary.latestTrendKg);
      setWeeklyPaceKg(summary.weeklyPace.weeklyPaceKg);
      setProjectedDate(summary.projection.projectedDate);
      setProjectionReason(summary.projection.reason);
      setGoalProgressPercent(summary.goalProgressPercent);
      setTrendHistory(summary.trendHistory);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, [currentGoalProfile?.user_id, currentGoalProfile?.current_weight_kg, currentGoalProfile?.target_weight_kg]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const logWeight = async (
    weightKg: number,
    date?: string,
    notes?: string,
  ): Promise<WeightLog> => {
    const db = await getDb();
    const userId = currentGoalProfile?.user_id ?? 'guest-user';
    const created = await logWeightService(db, userId, weightKg, date, undefined, notes);
    await loadData();
    return created;
  };

  const editWeight = async (
    id: string,
    weightKg: number,
    notes?: string,
  ): Promise<WeightLog | null> => {
    const db = await getDb();
    const userId = currentGoalProfile?.user_id ?? 'guest-user';
    const edited = await editWeightLog(db, userId, id, weightKg, notes);
    await loadData();
    return edited;
  };

  const deleteWeight = async (id: string): Promise<WeightLog | null> => {
    const db = await getDb();
    const userId = currentGoalProfile?.user_id ?? 'guest-user';
    const deleted = await deleteWeightLog(db, userId, id);
    await loadData();
    return deleted;
  };

  return {
    logs,
    latestLog,
    latestTrendKg,
    weeklyPaceKg,
    projectedDate,
    projectionReason,
    goalProgressPercent,
    trendHistory,
    loading,
    logWeight,
    editWeight,
    deleteWeight,
    refresh: loadData,
  };
}
