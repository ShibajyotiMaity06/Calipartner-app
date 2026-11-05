import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { plusTrialRemainingMs, type PlusTrialOffer } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { generateClientUuid } from '@/services/foodService';
import { claimPlusTrial, fetchPlusTrialOffer, plusTrialEvents } from '@/services/plusTrialService';

export function usePlusTrial() {
  const { user } = useAuth();
  const userId = user?.id;
  const owner = useRef(userId);
  owner.current = userId;
  const [state, setState] = useState<{ owner: string; offer: PlusTrialOffer } | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef<string | null>(null);
  const busy = useRef(false);
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const id = userId;
    if (!id) {
      setLoading(false);
      return;
    }
    const version = ++revision.current;
    try {
      const offer = await fetchPlusTrialOffer();
      if (owner.current === id && version === revision.current) {
        setState({ owner: id, offer });
        setError(false);
      }
    } catch {
      if (owner.current === id && version === revision.current) setError(true);
    } finally {
      if (owner.current === id) setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    requestId.current = null;
    setState(null);
    setLoading(Boolean(userId));
    setError(false);
    setStarting(false);
    void refresh();
  }, [userId, refresh]);
  useEffect(() => plusTrialEvents.subscribe(() => void refresh()), [refresh]);
  useEffect(() => {
    if (!userId) return;
    const timer = setInterval(() => void refresh(), 60000);
    return () => clearInterval(timer);
  }, [userId, refresh]);
  const offer = state?.owner === userId ? state?.offer : null;
  useEffect(() => {
    if (!offer?.active) return;
    const remaining = plusTrialRemainingMs(offer);
    const timer = setTimeout(() => void refresh(), remaining);
    return () => clearTimeout(timer);
  }, [offer, refresh]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (value) => {
      if (value === 'active') void refresh();
    });
    return () => listener.remove();
  }, [refresh]);
  const start = async () => {
    const id = userId;
    if (!id || busy.current) return false;
    busy.current = true;
    setStarting(true);
    setError(false);
    try {
      requestId.current ??= generateClientUuid();
      const result = await claimPlusTrial(requestId.current);
      if (owner.current !== id) return false;
      revision.current++;
      setState({ owner: id, offer: result });
      return true;
    } catch {
      if (owner.current === id) setError(true);
      return false;
    } finally {
      busy.current = false;
      if (owner.current === id) setStarting(false);
    }
  };
  return { offer, loading, starting, error, refresh, start };
}
