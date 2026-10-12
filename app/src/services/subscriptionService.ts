import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
  type UpgradeInfo,
  PRORATION_MODE,
} from 'react-native-purchases';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_REMOTE_CONFIG,
  type Entitlement,
  type RemoteConfigMap,
  type RoomTier,
} from '@calipartner/core';
import { env } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';

const logger = createLogger('subscriptionService');

let isPurchasesConfigured = false;

/**
 * Initialize RevenueCat SDK with platform-specific non-secret public API key.
 */
export async function initPurchases(userId?: string): Promise<boolean> {
  const apiKey =
    Platform.OS === 'ios'
      ? env.revenueCatAppleKey
      : Platform.OS === 'android'
        ? env.revenueCatGoogleKey
        : '';

  if (!apiKey) {
    logger.warn('RevenueCat API key not configured for current platform');
    return false;
  }

  try {
    if (!isPurchasesConfigured) {
      Purchases.configure({
        apiKey,
        appUserID: userId ?? null,
      });
      isPurchasesConfigured = true;
      logger.info('RevenueCat Purchases configured successfully', { userId });
    } else if (userId) {
      await Purchases.logIn(userId);
    }
    return true;
  } catch (err) {
    logger.error('Failed to configure RevenueCat Purchases', { err });
    return false;
  }
}

/**
 * Log out user from RevenueCat (e.g. on sign out)
 */
export async function logOutPurchases(): Promise<void> {
  try {
    if (isPurchasesConfigured) {
      await Purchases.logOut();
    }
  } catch (err) {
    logger.error('Error logging out from RevenueCat', { err });
  }
}

/**
 * Fetch offerings from RevenueCat (contains tiers: basic, plus, pro).
 */
export async function fetchOfferings(): Promise<PurchasesOfferings | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (err) {
    logger.error('Failed to fetch RevenueCat offerings', { err });
    return null;
  }
}

/**
 * Purchase a package. Supports upgrades and downgrades via upgradeInfo.
 */
export async function purchasePackage(
  pkg: PurchasesPackage,
  options?: {
    oldProductIdentifier?: string;
    isUpgrade?: boolean;
  },
): Promise<{ customerInfo: CustomerInfo; productIdentifier: string }> {
  try {
    let upgradeInfo: UpgradeInfo | undefined;
    let productChangeInfo: { oldProductIdentifier: string; prorationMode?: PRORATION_MODE } | undefined;

    if (options?.oldProductIdentifier) {
      const mode = options.isUpgrade
        ? PRORATION_MODE.IMMEDIATE_WITH_TIME_PRORATION
        : PRORATION_MODE.DEFERRED;
      upgradeInfo = {
        oldSKU: options.oldProductIdentifier,
        prorationMode: mode,
      };
      productChangeInfo = {
        oldProductIdentifier: options.oldProductIdentifier,
        prorationMode: mode,
      };
    }

    const { customerInfo, productIdentifier } = await Purchases.purchasePackage(
      pkg,
      upgradeInfo,
      productChangeInfo,
    );
    return { customerInfo, productIdentifier };
  } catch (err) {
    logger.error('Purchase failed', { err, packageId: pkg.identifier });
    throw err;
  }
}

/**
 * Restore previous store purchases and sync customer info.
 */
export async function restorePurchases(): Promise<CustomerInfo> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch (err) {
    logger.error('Restore purchases failed', { err });
    throw err;
  }
}

/**
 * Get current cached or refreshed customer info from RevenueCat.
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.getCustomerInfo();
  } catch (err) {
    logger.error('Failed to get customer info', { err });
    return null;
  }
}

/**
 * Fetch user entitlement from the database.
 * The `entitlements` table remains the ONLY source of truth; the app only displays it.
 */
export async function fetchUserEntitlement(
  client: SupabaseClient = getSupabase(),
): Promise<Entitlement | null> {
  try {
    const {
      data: { user },
      error: userErr,
    } = await client.auth.getUser();

    if (userErr || !user) {
      return null;
    }

    const { data, error } = await client
      .from('entitlements')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch user entitlement from Supabase', { error });
      return null;
    }

    return (data as Entitlement) ?? null;
  } catch (err) {
    logger.error('Error in fetchUserEntitlement', { err });
    return null;
  }
}

/**
 * Sponsor a room: attaches caller's plan to room, restoring it if locked.
 */
export async function sponsorRoom(
  roomId: string,
  client: SupabaseClient = getSupabase(),
): Promise<{ status: string; room_id: string; plan_holder_id: string }> {
  try {
    const { data, error } = await client.rpc('sponsor_room', {
      p_room_id: roomId,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch (err) {
    logger.error('Failed to sponsor room', { err, roomId });
    throw err;
  }
}

/**
 * Fetch remote configuration from Supabase remote_config table.
 */
export async function fetchRemoteConfig(
  client: SupabaseClient = getSupabase(),
): Promise<RemoteConfigMap> {
  try {
    const { data, error } = await client.from('remote_config').select('key, value');

    if (error || !data) {
      logger.warn('Using default remote config due to fetch error', { error });
      return DEFAULT_REMOTE_CONFIG;
    }

    const config: Partial<RemoteConfigMap> = {};
    for (const row of data) {
      if (row.key === 'room_caps') {
        config.room_caps = row.value as Record<RoomTier, number>;
      } else if (row.key === 'trial_length_days') {
        config.trial_length_days = Number(row.value);
      } else if (row.key === 'trial_cap') {
        config.trial_cap = Number(row.value);
      } else if (row.key === 'community_tier_enabled') {
        config.community_tier_enabled = Boolean(row.value);
      }
    }

    return {
      room_caps: config.room_caps ?? DEFAULT_REMOTE_CONFIG.room_caps,
      trial_length_days: config.trial_length_days ?? DEFAULT_REMOTE_CONFIG.trial_length_days,
      trial_cap: config.trial_cap ?? DEFAULT_REMOTE_CONFIG.trial_cap,
      community_tier_enabled:
        config.community_tier_enabled ?? DEFAULT_REMOTE_CONFIG.community_tier_enabled,
    };
  } catch (err) {
    logger.error('Error fetching remote config', { err });
    return DEFAULT_REMOTE_CONFIG;
  }
}
