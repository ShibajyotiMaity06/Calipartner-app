import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { workoutEvents } from '@/services/workoutEvents';
import { getWorkoutsCalendarData } from '@/services/workoutService';

const emptyCounts: Record<string, number> = {};

export function useWorkoutCalendar(visible: boolean, year: number, month: number) {
  const { user } = useAuth();
  const owner = user?.id ?? 'guest-user';
  const start = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  const scope = owner + start;
  const [result, setResult] = useState<{
    scope: string;
    counts: Record<string, number>;
  }>();
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!visible) return;
    return workoutEvents.subscribe(() => setRevision((value) => value + 1));
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setError(undefined);
    void getDb()
      .then((db) => getWorkoutsCalendarData(db, owner, start, end))
      .then((counts) => {
        if (active) setResult({ scope, counts });
      })
      .catch(() => {
        if (active) setError(scope);
      });
    return () => {
      active = false;
    };
  }, [visible, owner, start, end, scope, revision]);
  return {
    counts: result?.scope === scope ? result.counts : emptyCounts,
    loading: result?.scope !== scope && error !== scope,
    error: error === scope,
    retry: () => setRevision((value) => value + 1),
  };
}
