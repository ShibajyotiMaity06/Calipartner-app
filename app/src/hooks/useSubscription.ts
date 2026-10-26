import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';
import {
  DEFAULT_REMOTE_CONFIG,
  getTrialBannerInfo,
  hasPlan as checkHasPlan,
  type Entitlement,
  type RemoteConfigMap,
} from '@calipartner/core';
import {
  fetchOfferings,
  fetchRemoteConfig,
  fetchUserEntitlement,
  initPurchases,
  purchasePackage,
  restorePurchases,
  sponsorRoom,
} from '@/services/subscriptionService';
import { getSupabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';
import { t } from '@/i18n';

const logger = createLogger('useSubscription');

export function useSubscription() {
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [remoteConfig, setRemoteConfig] = useState<RemoteConfigMap>(DEFAULT_REMOTE_CONFIG);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const client = getSupabase();
      const {
        data: { user },
      } = await client.auth.getUser();

      if (user) {
        await initPurchases(user.id);
      }

      const [ent, config, offs] = await Promise.all([
        fetchUserEntitlement(client),
        fetchRemoteConfig(client),
        fetchOfferings(),
      ]);

      setEntitlement(ent);
      setRemoteConfig(config);
      setOfferings(offs);
      return ent;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      logger.error('Failed to load subscription data', { err });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Subscribe to realtime changes on user's own entitlements row
    const client = getSupabase();
    let channel: ReturnType<typeof client.channel> | null = null;
    let isMounted = true;

    void client.auth.getUser().then(({ data: { user } }) => {
      if (!user || !isMounted) return;

      const channelName = `entitlements:${user.id}:${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      channel = client
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'entitlements',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            logger.info('Realtime entitlement update received', { payload });
            setEntitlement(payload.new as Entitlement);
          },
        )
        .subscribe();
    });

    return () => {
      isMounted = false;
      if (channel) {
        client.removeChannel(channel);
        channel = null;
      }
    };
  }, [loadData]);

  const hasPlan = checkHasPlan(entitlement);
  const isTrial = entitlement?.status === 'trial';
  const isGrace = entitlement?.status === 'grace';
  const isLapsed = entitlement?.status === 'lapsed';
  const isUnattached = Boolean(entitlement?.is_unattached);

  const trialBanner = getTrialBannerInfo(entitlement?.trial_started_at);

  const purchase = async (
    pkg: PurchasesPackage,
    isUpgrade?: boolean,
    oldProductId?: string,
  ): Promise<'verified' | 'pending' | 'cancelled' | 'failed'> => {
    try {
      setLoading(true);
      setError(null);
      const client = getSupabase();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) throw new Error(t('fixes.signInPayment'));
      if (!(await initPurchases(user.id))) throw new Error(t('fixes.storeNotReady'));
      const result = await purchasePackage(pkg, {
        isUpgrade,
        oldProductIdentifier: oldProductId,
      });
      // A completed checkout is not an entitlement. Wait for the authenticated webhook.
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt) await new Promise((resolve) => setTimeout(resolve, 1000));
        const latest = await fetchUserEntitlement(client);
        if (
          latest?.user_id === user.id &&
          latest.store_product_id === result.productIdentifier &&
          (checkHasPlan(latest) ||
            (latest.status === 'trial' &&
              Boolean(latest.period_end && new Date(latest.period_end) > new Date())))
        ) {
          setEntitlement(latest);
          return 'verified';
        }
      }
      return 'pending';
    } catch (err: unknown) {
      const cancelled = Boolean(
        err && typeof err === 'object' && 'userCancelled' in err && err.userCancelled,
      );
      setError(t(cancelled ? 'fixes.storeCancelled' : 'fixes.paymentFailed'));
      return cancelled ? 'cancelled' : 'failed';
    } finally {
      setLoading(false);
    }
  };

  const restore = async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      if (Platform.OS !== 'web') await restorePurchases();
      const latest = await loadData();
      const active =
        checkHasPlan(latest) ||
        Boolean(
          latest?.status === 'trial' &&
          latest.period_end &&
          new Date(latest.period_end) > new Date(),
        );
      if (!active) setError(t('fixes.paymentPending'));
      return active;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const sponsor = async (roomId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      await sponsorRoom(roomId);
      await loadData();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const currentTier = entitlement?.tier ?? 'free';
  const hasActiveAccess =
    ((currentTier === 'plus' || currentTier === 'pro') && hasPlan) ||
    (currentTier === 'plus' &&
      isTrial &&
      Boolean(entitlement?.period_end && new Date(entitlement.period_end) > new Date()));

  return {
    entitlement,
    currentTier,
    hasActiveAccess,
    remoteConfig,
    offerings,
    hasPlan,
    isTrial,
    isGrace,
    isLapsed,
    isUnattached,
    trialBanner,
    loading,
    error,
    refresh: loadData,
    purchase,
    restore,
    sponsor,
  };
}
