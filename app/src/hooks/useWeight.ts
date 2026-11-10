import { generateClientUuid } from '@/services/foodService';
import { loadAccountTable } from '@/services/accountDataService';
import { useCallback, useEffect, useRef, useState } from 'react';
import { challengeLocalDate, type WeightLog, type WeightTrendPoint } from '@calipartner/core';
import { getDb } from '@/db';
import {
  deleteWeightLog,
  editWeightLog,
  getWeightLogs,
  getWeightSummary,
  logWeight as logWeightService,
} from '@/services/weightService';
import { useTargets } from './useTargets';
import { useAuth } from '@/contexts/AuthContext';

export interface UseWeightResult {
  logs: WeightLog[];
  startingWeightKg: number | null;
  latestLog: WeightLog | null;
  latestTrendKg: number | null;
  weeklyPaceKg: number | null;
  projectedDate: string | null;
  projectionReason: 'achieved' | 'on_track' | 'not_enough_trend' | 'wrong_direction';
  goalProgressPercent: number;
  trendHistory: WeightTrendPoint[];
  loading: boolean;
  error: string | null;
  logWeight: (weightKg: number, date?: string, notes?: string) => Promise<WeightLog>;
  editWeight: (
    id: string,
    weightKg: number,
    notes?: string,
    date?: string,
  ) => Promise<WeightLog | null>;
  deleteWeight: (id: string) => Promise<WeightLog | null>;
  refresh: () => Promise<void>;
}

export function useWeight(): UseWeightResult {
  const { user, profile } = useAuth();
  const userId = user?.id ?? 'guest-user';
  const { currentGoalProfile } = useTargets();

  const weightRequest = useRef<{ key: string; id: string } | null>(null);
  const [startingWeightKg, setStartingWeightKg] = useState<number | null>(null);
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const db = await getDb();

      await loadAccountTable(db, 'weight_logs', userId);
      const [fetchedLogs, summary] = await Promise.all([
        getWeightLogs(db, userId, 100000),
        getWeightSummary(db, userId, {
          startingWeightKg: currentGoalProfile?.current_weight_kg,
          targetWeightKg: currentGoalProfile?.target_weight_kg,
        }),
      ]);

      setLogs(fetchedLogs);
      setStartingWeightKg(
        summary.startingWeightKg ?? currentGoalProfile?.current_weight_kg ?? null,
      );
      setLatestLog(summary.latestLog);
      setLatestTrendKg(summary.latestTrendKg);
      setWeeklyPaceKg(summary.weeklyPace.weeklyPaceKg);
      setProjectedDate(summary.projection.projectedDate);
      setProjectionReason(summary.projection.reason);
      setGoalProgressPercent(summary.goalProgressPercent);
      setTrendHistory(summary.trendHistory);
    } catch {
      setError('WEIGHT_UNAVAILABLE');
    } finally {
      setLoading(false);
    }
  }, [userId, currentGoalProfile?.current_weight_kg, currentGoalProfile?.target_weight_kg]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const logWeight = async (weightKg: number, date?: string, notes?: string): Promise<WeightLog> => {
    const db = await getDb();
    const localDay = date ?? challengeLocalDate(new Date(), profile?.timezone ?? 'UTC');
    const key = JSON.stringify([userId, weightKg, localDay, notes ?? null]);
    if (weightRequest.current?.key !== key)
      weightRequest.current = { key, id: generateClientUuid() };
    const created = await logWeightService(
      db,
      userId,
      weightKg,
      localDay,
      undefined,
      notes,
      challengeLocalDate(new Date(), profile?.timezone ?? 'UTC'),
      weightRequest.current.id,
    );
    weightRequest.current = null;
    await loadData();
    return created;
  };

  const editWeight = async (
    id: string,
    weightKg: number,
    notes?: string,
    date?: string,
  ): Promise<WeightLog | null> => {
    const db = await getDb();
    const edited = await editWeightLog(
      db,
      userId,
      id,
      weightKg,
      notes,
      date,
      challengeLocalDate(new Date(), profile?.timezone ?? 'UTC'),
    );
    await loadData();
    return edited;
  };

  const deleteWeight = async (id: string): Promise<WeightLog | null> => {
    const db = await getDb();
    const deleted = await deleteWeightLog(db, userId, id);
    await loadData();
    return deleted;
  };

  return {
    startingWeightKg,
    logs,
    latestLog,
    latestTrendKg,
    weeklyPaceKg,
    projectedDate,
    projectionReason,
    goalProgressPercent,
    trendHistory,
    loading,
    error,
    logWeight,
    editWeight,
    deleteWeight,
    refresh: loadData,
  };
}
