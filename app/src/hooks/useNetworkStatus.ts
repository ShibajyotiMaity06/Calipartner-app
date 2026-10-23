import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export interface NetworkStatus {
  /** `null` until the first status is known. */
  isOnline: boolean | null;
}

interface WebGlobal {
  navigator?: { onLine?: boolean };
  addEventListener?: (event: string, handler: () => void) => void;
  removeEventListener?: (event: string, handler: () => void) => void;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean | null>(() => {
    if (Platform.OS === 'web' && typeof globalThis !== 'undefined') {
      const g = globalThis as unknown as WebGlobal;
      if (typeof g.navigator?.onLine === 'boolean') {
        return g.navigator.onLine;
      }
    }
    return true;
  });

  useEffect(() => {
    if (Platform.OS === 'web' && typeof globalThis !== 'undefined') {
      const g = globalThis as unknown as WebGlobal;
      if (typeof g.addEventListener === 'function') {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        g.addEventListener('online', handleOnline);
        g.addEventListener('offline', handleOffline);

        if (typeof g.navigator?.onLine === 'boolean') {
          setIsOnline(g.navigator.onLine);
        }

        return () => {
          g.removeEventListener?.('online', handleOnline);
          g.removeEventListener?.('offline', handleOffline);
        };
      }
    }

    const unsubscribe = NetInfo.addEventListener((state) => {
      // Treat only explicit false as offline
      const online = state.isConnected !== false && state.isInternetReachable !== false;
      setIsOnline(online);
    });
    return unsubscribe;
  }, []);

  return { isOnline };
}
