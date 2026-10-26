import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
  type PurchasesStoreTransaction,
  PRORATION_MODE,
} from 'react-native-purchases';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchOfferings,
  fetchRemoteConfig,
  fetchUserEntitlement,
  initPurchases,
  purchasePackage,
  restorePurchases,
  sponsorRoom,
} from './subscriptionService';

vi.mock('@/lib/env', () => ({
  env: {
    appEnv: 'production',
    revenueCatAppleKey: 'appl_test',
    revenueCatGoogleKey: 'goog_test',
  },
}));
vi.mock('react-native-purchases', () => {
  return {
    default: {
      configure: vi.fn(),
      logIn: vi.fn(),
      logOut: vi.fn(),
      getOfferings: vi.fn(),
      purchasePackage: vi.fn(),
      restorePurchases: vi.fn(),
      getCustomerInfo: vi.fn(),
    },
    PRORATION_MODE: {
      IMMEDIATE_WITH_TIME_PRORATION: 1,
      DEFERRED: 2,
    },
  };
});

describe('Phase 10: subscriptionService (Client SDK & Supabase Sync)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    Platform.OS = 'android';
    await initPurchases('user-123');
  });

  it('configures Purchases SDK on initPurchases', async () => {
    const success = await initPurchases('user-123');
    expect(success).toBe(true);
  });

  it('never configures RevenueCat or simulates a native purchase in a browser', async () => {
    Platform.OS = 'web';
    expect(await initPurchases('web-user')).toBe(false);
    await expect(
      purchasePackage({ identifier: 'plus_annual' } as PurchasesPackage),
    ).rejects.toThrow();
    expect(Purchases.purchasePackage).not.toHaveBeenCalled();
  });

  it('refuses anonymous purchases and does not invent paid access for an email address', async () => {
    expect(await initPurchases()).toBe(false);
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = {
      auth: {
        getUser: async () => ({
          data: { user: { id: 'vip', email: 'shibajyoti.maity06@gmail.com' } },
        }),
      },
      from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) })),
    } as unknown as SupabaseClient;
    expect(await fetchUserEntitlement(client)).toBeNull();
    expect(client.from).toHaveBeenCalledWith('entitlements');
  });

  it('fetches offerings from Purchases SDK', async () => {
    const mockOfferings = {
      current: {
        identifier: 'basic',
        availablePackages: [{ identifier: 'basic_monthly' }],
      },
      all: {},
    } as unknown as PurchasesOfferings;
    vi.mocked(Purchases.getOfferings).mockResolvedValueOnce(mockOfferings);

    const result = await fetchOfferings();
    expect(Purchases.getOfferings).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockOfferings);
  });

  it('handles upgrade proration mode when purchasing upgraded package', async () => {
    const mockPackage = {
      identifier: 'plus_monthly',
      packageType: 'MONTHLY',
    } as unknown as PurchasesPackage;

    vi.mocked(Purchases.purchasePackage).mockResolvedValueOnce({
      customerInfo: { entitlements: { active: {} } } as unknown as CustomerInfo,
      productIdentifier: 'plus_monthly',
      transaction: {} as unknown as PurchasesStoreTransaction,
    });

    const result = await purchasePackage(mockPackage, {
      oldProductIdentifier: 'basic_monthly',
      isUpgrade: true,
    });

    expect(Purchases.purchasePackage).toHaveBeenCalledWith(
      mockPackage,
      {
        oldSKU: 'basic_monthly',
        prorationMode: PRORATION_MODE.IMMEDIATE_WITH_TIME_PRORATION,
      },
      {
        oldProductIdentifier: 'basic_monthly',
        prorationMode: PRORATION_MODE.IMMEDIATE_WITH_TIME_PRORATION,
      },
    );
    expect(result.productIdentifier).toBe('plus_monthly');
  });

  it('handles downgrade deferred proration mode when purchasing lower package', async () => {
    const mockPackage = {
      identifier: 'basic_monthly',
      packageType: 'MONTHLY',
    } as unknown as PurchasesPackage;

    vi.mocked(Purchases.purchasePackage).mockResolvedValueOnce({
      customerInfo: { entitlements: { active: {} } } as unknown as CustomerInfo,
      productIdentifier: 'basic_monthly',
      transaction: {} as unknown as PurchasesStoreTransaction,
    });

    const result = await purchasePackage(mockPackage, {
      oldProductIdentifier: 'pro_monthly',
      isUpgrade: false,
    });

    expect(Purchases.purchasePackage).toHaveBeenCalledWith(
      mockPackage,
      {
        oldSKU: 'pro_monthly',
        prorationMode: PRORATION_MODE.DEFERRED,
      },
      {
        oldProductIdentifier: 'pro_monthly',
        prorationMode: PRORATION_MODE.DEFERRED,
      },
    );
    expect(result.productIdentifier).toBe('basic_monthly');
  });

  it('restores purchases via Purchases SDK', async () => {
    const mockCustomerInfo = { entitlements: { active: {} } } as unknown as CustomerInfo;
    vi.mocked(Purchases.restorePurchases).mockResolvedValueOnce(mockCustomerInfo);

    const result = await restorePurchases();
    expect(Purchases.restorePurchases).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockCustomerInfo);
  });

  it('fetches user entitlement from Supabase database', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-456' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                user_id: 'user-456',
                tier: 'pro',
                period: 'annual',
                status: 'paid',
                attached_room_id: 'room-abc',
                is_unattached: false,
              },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const entitlement = await fetchUserEntitlement(mockSupabase);
    expect(entitlement).not.toBeNull();
    expect(entitlement?.tier).toBe('pro');
    expect(entitlement?.status).toBe('paid');
  });

  it('sponsors a room by calling sponsor_room RPC', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          status: 'sponsored',
          room_id: 'room-789',
          plan_holder_id: 'user-456',
        },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const result = await sponsorRoom('room-789', mockSupabase);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('sponsor_room', {
      p_room_id: 'room-789',
    });
    expect(result.status).toBe('sponsored');
  });

  it('fetches remote config from remote_config table', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [
            { key: 'room_caps', value: { basic: 5, plus: 20, pro: 50, community: 100 } },
            { key: 'trial_length_days', value: 3 },
            { key: 'trial_cap', value: 5 },
            { key: 'community_tier_enabled', value: true },
          ],
          error: null,
        }),
      }),
    } as unknown as SupabaseClient;

    const config = await fetchRemoteConfig(mockSupabase);
    expect(config.room_caps.basic).toBe(5);
    expect(config.community_tier_enabled).toBe(true);
  });
});
