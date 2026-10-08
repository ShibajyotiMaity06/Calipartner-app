import { useCallback, useState } from 'react';
import { validateUsername, type PublicUserProfile } from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';

export type UsernameCheckStatus =
  'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'reserved' | 'held' | 'error';

export function useUsername() {
  const [status, setStatus] = useState<UsernameCheckStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkAvailability = useCallback(async (username: string): Promise<boolean> => {
    const trimmed = username.trim();
    if (!trimmed) {
      setStatus('idle');
      setErrorMessage(null);
      return false;
    }

    const validation = validateUsername(trimmed);
    if (!validation.isValid) {
      if (validation.error === 'RESERVED_WORD') {
        setStatus('reserved');
      } else {
        setStatus('invalid');
      }
      setErrorMessage(validation.error ?? 'INVALID');
      return false;
    }

    setStatus('checking');
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc('is_username_available', {
        check_username: trimmed,
      });

      if (error) {
        setStatus('error');
        setErrorMessage(error.message);
        return false;
      }

      if (data === true) {
        setStatus('available');
        setErrorMessage(null);
        return true;
      } else {
        setStatus('taken');
        setErrorMessage(null);
        return false;
      }
    } catch {
      setStatus('error');
      setErrorMessage('Network or server error');
      return false;
    }
  }, []);

  const searchUsers = useCallback(async (prefix: string): Promise<PublicUserProfile[]> => {
    const cleanPrefix = prefix.trim();
    if (cleanPrefix.length < 3) return [];

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc('search_users', {
        prefix: cleanPrefix,
      });

      if (error || !data) {
        return [];
      }
      return data as PublicUserProfile[];
    } catch {
      return [];
    }
  }, []);

  return {
    status,
    errorMessage,
    checkAvailability,
    searchUsers,
    setStatus,
  };
}
