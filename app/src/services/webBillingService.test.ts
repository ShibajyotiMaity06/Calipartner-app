import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), dodo: vi.fn(), navigate: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({ functions: { invoke: mocks.invoke } }) }));
vi.mock('./dodoService', () => ({
  createDodoCheckout: mocks.dodo,
  navigateToCheckout: mocks.navigate,
}));
import { Platform } from 'react-native';
import {
  fetchWebCatalog,
  startWebCheckout,
  saveBillingCountry,
  cancelRazorpayRenewal,
} from './webBillingService';
beforeEach(() => {
  vi.clearAllMocks();
  Platform.OS = 'web';
});
afterEach(() => {
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
  it('requires server acknowledgements for country changes and renewal cancellation', async () => {
    mocks.invoke
      .mockResolvedValueOnce({ data: { country: 'IN' } })
      .mockResolvedValueOnce({ data: { status: 'renewal_cancelled' } })
      .mockResolvedValueOnce({ data: { country: 'US' } });
    await saveBillingCountry('IN');
    await cancelRazorpayRenewal('request-id');
    await expect(saveBillingCountry('IN')).rejects.toThrow();
  });
  it('accepts only complete catalogs in the selected provider currency', async () => {
    const products = ['plus_monthly', 'plus_annual', 'pro_monthly', 'pro_annual'].map((key) => ({
      key,
      currency: 'INR',
      amount: 249,
      trialDays: key.startsWith('plus') ? 7 : 0,
    }));
    mocks.invoke
      .mockResolvedValueOnce({ data: { provider: 'razorpay', products } })
      .mockResolvedValueOnce({ data: { provider: 'dodo', products } });
    expect((await fetchWebCatalog()).provider).toBe('razorpay');
    await expect(fetchWebCatalog()).rejects.toThrow();
  });
});
