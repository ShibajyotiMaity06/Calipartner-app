import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getLocalDateString } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';

export function useCurrentLocalDate() {
  const { profile } = useAuth();
  const timeZone = profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [localDate, setLocalDate] = useState(() => getLocalDateString(new Date(), timeZone));
  useEffect(() => {
    const update = () => setLocalDate(getLocalDateString(new Date(), timeZone));
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      update();
      timer = setTimeout(tick, 60000 - (Date.now() % 60000));
    };
    tick();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => {
      clearTimeout(timer);
      listener.remove();
    };
  }, [timeZone]);
  return { localDate, timeZone };
}
