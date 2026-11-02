import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { getSupabase } from '@/lib/supabase';
import { diaryEvents } from '@/services/diaryEvents';

export function useCheckInHistory(startDate: string, endDate: string) {
  const { user } = useAuth();
  const [days, setDays] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const version = useRef(0);
  const invalidate = useCallback(() => {
    version.current++;
  }, []);
  const refresh = useCallback(async () => {
    const request = ++version.current;
    if (!user?.id) {
      setLoading(false);
      setDays([]);
      return;
    }
    setLoading(true);
    setError(false);
    const dates = new Set<string>();
    try {
      const db = await getDb();
      const local = await db.getAllAsync<{ local_date: string }>(
        'SELECT local_date FROM local_squad_check_ins WHERE user_id=? AND local_date>=? AND local_date<=?',
        [user.id, startDate, endDate],
      );
      local.forEach((row) => dates.add(row.local_date));
      const result = await getSupabase()
        .from('squad_check_ins')
        .select('local_date')
        .eq('user_id', user.id)
        .gte('local_date', startDate)
        .lte('local_date', endDate);
      if (result.error) throw result.error;
      result.data?.forEach((row) => dates.add(row.local_date));
    } catch {
      if (request === version.current) setError(true);
    } finally {
      if (request === version.current) {
        setDays([...dates]);
        setLoading(false);
      }
    }
  }, [user?.id, startDate, endDate]);
  useEffect(() => {
    void refresh();
    const unsubscribe = diaryEvents.subscribe(() => void refresh());
    return () => {
      invalidate();
      unsubscribe();
    };
  }, [refresh, invalidate]);
  return { days, error, loading, refresh };
}
