import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { PurchasesPackage } from 'react-native-purchases';
const sdk = vi.hoisted(() => ({
  init: vi.fn(async () => true),
  buy: vi.fn(async () => ({ productIdentifier: 'pro_annual' })),
  entitlement: vi.fn<() => Promise<unknown>>(async () => null),
  restore: vi.fn(async () => ({})),
}));
vi.mock('@/services/subscriptionService', () => ({
  initPurchases: sdk.init,
  purchasePackage: sdk.buy,
  fetchUserEntitlement: sdk.entitlement,
  fetchRemoteConfig: async () => ({}),
  fetchOfferings: async () => null,
  restorePurchases: sdk.restore,
  sponsorRoom: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-a' } } }) },
    channel: () => ({
      on() {
        return this;
      },
      subscribe() {
        return this;
      },
    }),
    removeChannel: vi.fn(),
  }),
}));
import { useSubscription } from './useSubscription';
let state!: ReturnType<typeof useSubscription>;
let renderer: ReactTestRenderer;
function Harness() {
  state = useSubscription();
  return null;
}
beforeEach(async () => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.clearAllMocks();
  sdk.entitlement.mockResolvedValue(null);
  sdk.init.mockResolvedValue(true);
  await act(async () => {
    renderer = create(<Harness />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  vi.useRealTimers();
});
describe('checkout requires server verification', () => {
  it('keeps a completed checkout pending when the database has no matching entitlement', async () => {
    let result: unknown;
    await act(async () => {
      const task = state.purchase({} as PurchasesPackage).then((value) => {
        result = value;
      });
      await vi.runAllTimersAsync();
      await task;
    });
    expect(result).toBe('pending');
    expect(state.hasActiveAccess).toBe(false);
  });
  it('activates only the matching product confirmed by the server', async () => {
    sdk.entitlement.mockResolvedValue({
      user_id: 'user-a',
      tier: 'pro',
      period: 'annual',
      status: 'paid',
      store_product_id: 'pro_annual',
      period_end: '2099-01-01',
    });
    let result: unknown;
    await act(async () => {
      result = await state.purchase({} as PurchasesPackage);
    });
    expect(result).toBe('verified');
    expect(state.hasActiveAccess).toBe(true);
  });
  it('does not treat checkout cancellation or missing configuration as a purchase', async () => {
    sdk.buy.mockRejectedValueOnce({ userCancelled: true });
    let result: unknown;
    await act(async () => {
      result = await state.purchase({} as PurchasesPackage);
    });
    expect(result).toBe('cancelled');
    expect(state.hasActiveAccess).toBe(false);
    sdk.init.mockResolvedValue(false);
    sdk.buy.mockClear();
    await act(async () => {
      result = await state.purchase({} as PurchasesPackage);
    });
    expect(result).toBe('failed');
    expect(sdk.buy).not.toHaveBeenCalled();
  });
  it('does not claim a successful restore without an active database entitlement', async () => {
    let result: unknown;
    await act(async () => {
      result = await state.restore();
    });
    expect(result).toBe(false);
    expect(state.hasActiveAccess).toBe(false);
  });
});
