import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  dodo: vi.fn(),
  navigate: vi.fn(),
  session: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ functions: { invoke: mocks.invoke }, auth: { getSession: mocks.session } }),
}));
vi.mock('./dodoService', () => ({
  createDodoCheckout: mocks.dodo,
  navigateToCheckout: mocks.navigate,
}));
import { Platform } from 'react-native';
import {
  fetchWebCatalog,
  startWebCheckout,
  fetchBillingCountry,
  getCachedWebCatalog,
  cancelRazorpayRenewal,
} from './webBillingService';
let sessionSequence = 0;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({
    data: { session: { access_token: `fixture-session-${++sessionSequence}` } },
  });
  Platform.OS = 'web';
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Platform.OS = 'web';
});
const checkout = {
  provider: 'razorpay',
  key_id: 'rzp_live_Fixture',
  subscription_id: 'sub_Fixture',
  request_id: 'request-id',
  email: 'fixture@example.invalid',
};
describe('platform-separated web billing', () => {
  it('reuses prepared prices only for the same session and refreshes expired quotes', async () => {
    const products = (currency: string) =>
      ['plus_monthly', 'plus_annual', 'pro_monthly', 'pro_annual'].map((key) => ({
        key,
        currency,
        amount: 249,
      }));
    mocks.invoke
      .mockResolvedValueOnce({ data: { country: 'IN' } })
      .mockResolvedValueOnce({ data: { provider: 'razorpay', products: products('INR') } });
    const first = await fetchWebCatalog();
    expect(getCachedWebCatalog(`fixture-session-${sessionSequence}`)).toBe(first);
    expect(getCachedWebCatalog('another-session')).toBeUndefined();
    expect(await fetchWebCatalog()).toBe(first);
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5 * 60 * 1000 + 1);
    expect(getCachedWebCatalog(`fixture-session-${sessionSequence}`)).toBeUndefined();
    mocks.invoke
      .mockResolvedValueOnce({ data: { country: 'US' } })
      .mockResolvedValueOnce({ data: { provider: 'dodo', products: products('USD') } });
    expect((await fetchWebCatalog()).provider).toBe('dodo');
    expect(mocks.invoke).toHaveBeenCalledTimes(4);
  });
  it('does not share country or subscription management flags across signed-in sessions', async () => {
    mocks.session
      .mockResolvedValueOnce({ data: { session: { access_token: 'account-one' } } })
      .mockResolvedValueOnce({ data: { session: { access_token: 'account-two' } } });
    mocks.invoke.mockResolvedValue({ data: { error: 'BILLING_COUNTRY_REQUIRED' } });
    const results = await Promise.allSettled([fetchWebCatalog(), fetchWebCatalog()]);
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
  });
  it('shares concurrent pricing loads without caching a failed country lookup', async () => {
    let finish!: (value: unknown) => void;
    mocks.invoke.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = fetchWebCatalog();
    const second = fetchWebCatalog();
    await Promise.resolve();
    expect(mocks.invoke).toHaveBeenCalledOnce();
    finish({ data: { error: 'BILLING_COUNTRY_REQUIRED' } });
    await expect(first).rejects.toThrow();
    await expect(second).rejects.toThrow();
    mocks.invoke.mockResolvedValueOnce({ data: { country: 'US' } }).mockResolvedValueOnce({
      data: {
        provider: 'dodo',
        products: ['plus_monthly', 'plus_annual', 'pro_monthly', 'pro_annual'].map((key) => ({
          key,
          currency: 'USD',
          amount: 4.99,
        })),
      },
    });
    expect((await fetchWebCatalog()).provider).toBe('dodo');
    expect(mocks.invoke).toHaveBeenCalledTimes(3);
  });
  it.each(['ios', 'android'] as const)(
    'never loads or calls web payments from %s',
    async (platform) => {
      Platform.OS = platform;
      await expect(startWebCheckout('razorpay', 'plus', 'monthly', 'request-id')).rejects.toThrow();
      await expect(startWebCheckout('dodo', 'plus', 'monthly', 'request-id')).rejects.toThrow();
      await expect(fetchWebCatalog()).rejects.toThrow();
      expect(mocks.invoke).not.toHaveBeenCalled();
      expect(mocks.dodo).not.toHaveBeenCalled();
    },
  );
  it('opens international Dodo checkout with the same stable ID', async () => {
    mocks.dodo.mockResolvedValue('https://checkout.dodopayments.com/session');
    expect(await startWebCheckout('dodo', 'pro', 'annual', 'request-id')).toBe('redirected');
    expect(mocks.dodo).toHaveBeenCalledWith('pro', 'annual', 'request-id');
    expect(mocks.navigate).toHaveBeenCalledWith('https://checkout.dodopayments.com/session');
  });
  it('a Razorpay callback waits for webhook confirmation even when receipt verification fails', async () => {
    let options: Record<string, unknown> = {};
    vi.stubGlobal(
      'Razorpay',
      class {
        constructor(value: Record<string, unknown>) {
          options = value;
        }
        open() {
          (options.handler as (r: unknown) => void)({
            razorpay_payment_id: 'pay_Fixture',
            razorpay_subscription_id: 'sub_Fixture',
            razorpay_signature: 'receipt-signature',
          });
        }
      },
    );
    mocks.invoke
      .mockResolvedValueOnce({ data: checkout, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('verification offline') });
    expect(await startWebCheckout('razorpay', 'plus', 'monthly', 'request-id')).toBe('pending');
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, 'web-billing', {
      body: { tier: 'plus', duration: 'monthly', request_id: 'request-id' },
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, 'razorpay-checkout', {
      body: {
        action: 'verify',
        request_id: 'request-id',
        razorpay_payment_id: 'pay_Fixture',
        razorpay_subscription_id: 'sub_Fixture',
        razorpay_signature: 'receipt-signature',
      },
    });
    expect(options).not.toHaveProperty('amount');
    expect(options).not.toHaveProperty('key_secret');
  });
  it('modal dismissal is cancellation and never a purchase', async () => {
    vi.stubGlobal(
      'Razorpay',
      class {
        constructor(private options: { modal: { ondismiss: () => void } }) {}
        open() {
          this.options.modal.ondismiss();
        }
      },
    );
    mocks.invoke
      .mockResolvedValueOnce({ data: checkout })
      .mockResolvedValueOnce({ data: { status: 'checkout_cancelled' } });
    expect(await startWebCheckout('razorpay', 'plus', 'monthly', 'request-id')).toBe('cancelled');
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
  });
  it('missing configuration and malformed checkout data cannot open a payment modal', async () => {
    const open = vi.fn();
    vi.stubGlobal(
      'Razorpay',
      class {
        open = open;
      },
    );
    mocks.invoke
      .mockResolvedValueOnce({ data: null, error: new Error('missing keys') })
      .mockResolvedValueOnce({ data: { ...checkout, subscription_id: 'https://evil.example' } });
    await expect(startWebCheckout('razorpay', 'pro', 'annual', 'request-id')).rejects.toThrow();
    await expect(startWebCheckout('razorpay', 'pro', 'annual', 'request-id')).rejects.toThrow();
    expect(open).not.toHaveBeenCalled();
  });
  it('requires acknowledged automatic country detection and renewal cancellation', async () => {
    mocks.invoke
      .mockResolvedValueOnce({ data: { country: 'IN' } })
      .mockResolvedValueOnce({ data: { status: 'renewal_cancelled' } })
      .mockResolvedValueOnce({ data: { country: 'ZZ' } });
    expect(await fetchBillingCountry()).toBe('IN');
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, 'web-billing', { body: { action: 'routing' } });
    await cancelRazorpayRenewal('request-id');
    await expect(fetchBillingCountry()).rejects.toThrow();
  });
  it('accepts only complete catalogs in the selected provider currency', async () => {
    const products = ['plus_monthly', 'plus_annual', 'pro_monthly', 'pro_annual'].map((key) => ({
      key,
      currency: 'INR',
      amount: 249,
      trialDays: key.startsWith('plus') ? 7 : 0,
    }));
    mocks.invoke
      .mockResolvedValueOnce({ data: { country: 'IN' } })
      .mockResolvedValueOnce({ data: { provider: 'razorpay', products } })
      .mockResolvedValueOnce({ data: { country: 'US' } })
      .mockResolvedValueOnce({ data: { provider: 'dodo', products } });
    expect((await fetchWebCatalog()).provider).toBe('razorpay');
    await expect(fetchWebCatalog({ force: true })).rejects.toThrow();
  });
  it('does not request a catalog or default to dollars when country detection fails', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: { error: 'BILLING_COUNTRY_REQUIRED' } });
    await expect(fetchWebCatalog()).rejects.toThrow('detect your country');
    expect(mocks.invoke).toHaveBeenCalledOnce();
  });
});
