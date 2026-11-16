import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { useAuth } from '@/contexts/AuthContext';
import { useAvatar } from './useAvatar';
import { useNetworkStatus } from './useNetworkStatus';
import { fetchCCWebCatalog } from '@/services/ccWebService';
import { fetchAvatarPacks } from '@/services/avatarPackService';

type Catalog = Awaited<ReturnType<typeof fetchCCWebCatalog>>;
interface CatalogState {
  web: Catalog | null;
  packages: PurchasesPackage[];
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
}
const Context = createContext<CatalogState>({
  web: null,
  packages: [],
  loading: true,
  error: false,
  refresh: async () => {},
});
function CatalogSession({ userId, children }: { userId: string; children: React.ReactNode }) {
  const { state } = useAvatar();
  const { isOnline } = useNetworkStatus();
  const ids =
    Platform.OS === 'web'
      ? ''
      : (state?.packs
          ?.map((p) => p.store_product_id)
          .sort()
          .join(',') ?? '');
  const [web, setWeb] = useState<Catalog | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const pending = useRef<Promise<void> | null>(null);
  const loadedAt = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const refresh = useCallback(async () => {
    if (!userId || (Platform.OS !== 'web' && !ids) || isOnline === false) {
      setLoading(false);
      return;
    }
    if (pending.current) return pending.current;
    setLoading(true);
    const task = (async () => {
      try {
        if (Platform.OS === 'web') {
          const catalog = await fetchCCWebCatalog();
          if (alive.current) setWeb(catalog);
        } else {
          const rows = await fetchAvatarPacks(userId, ids.split(','));
          if (!rows.length) throw new Error('STORE_CATALOG_UNAVAILABLE');
          if (alive.current) setPackages(rows);
        }
        if (alive.current) {
          loadedAt.current = Date.now();
          setError(false);
        }
      } catch {
        if (alive.current) setError(true);
      } finally {
        if (alive.current) setLoading(false);
        pending.current = null;
      }
    })();
    pending.current = task;
    return task;
  }, [userId, ids, isOnline]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (status) => {
      if (status === 'active' && Date.now() - loadedAt.current > 10 * 60 * 1000) void refresh();
    });
    return () => listener.remove();
  }, [refresh]);
  return (
    <Context.Provider value={{ web, packages, loading, error, refresh }}>
      {children}
    </Context.Provider>
  );
}
/** Preload at sign-in, retain across routes, and isolate store identity on account changes. */
export function CoinCatalogProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <CatalogSession key={user?.id ?? 'guest'} userId={user?.id ?? ''}>
      {children}
    </CatalogSession>
  );
}
export const useCoinCatalog = () => useContext(Context);
