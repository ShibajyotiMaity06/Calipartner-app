import { describe, expect, it } from 'vitest';
import {
  verifiedRazorpayPlan,
  webBillingProvider,
  razorpayEpoch,
  isCapturedRazorpayInvoice,
} from './webBilling';
describe('web billing boundaries', () => {
  it('paid access requires a captured INR payment and a fully paid matching-price invoice', () => {
    const product = verifiedRazorpayPlan('plus_monthly', {
      period: 'monthly',
      interval: 1,
      item: { currency: 'INR', amount: 24900 },
    });
    const payment = { status: 'captured', currency: 'INR', amount: 24900, amount_refunded: 0 };
    const invoice = { status: 'paid', currency: 'INR', amount_paid: 24900 };
    expect(isCapturedRazorpayInvoice(payment, invoice, product)).toBe(true);
    expect(isCapturedRazorpayInvoice({ ...payment, amount_refunded: 100 }, invoice, product)).toBe(
      true,
    );
    for (const patch of [
      { status: 'authorized' },
      { amount: 100 },
      { currency: 'USD' },
      { amount_refunded: 24900 },
    ])
      expect(isCapturedRazorpayInvoice({ ...payment, ...patch }, invoice, product)).toBe(false);
    for (const patch of [{ status: 'issued' }, { amount_paid: 100 }, { currency: 'USD' }])
      expect(isCapturedRazorpayInvoice(payment, { ...invoice, ...patch }, product)).toBe(false);
  });
  it.each(['android', 'ios'])('keeps %s on RevenueCat in every country', (platform) => {
    for (const country of ['IN', 'US', null, ''])
      expect(webBillingProvider(platform, country)).toBe('revenuecat');
  });
  it('routes India to Razorpay and international web to Dodo with no missing-country default', () => {
    expect(webBillingProvider('web', ' in ')).toBe('razorpay');
    for (const country of ['US', 'GB', 'CA', 'SG'])
      expect(webBillingProvider('web', country)).toBe('dodo');
    for (const country of [null, '', 'India', 0, 'USA'])
      expect(() => webBillingProvider('web', country)).toThrow('BILLING_COUNTRY_REQUIRED');
  });
  it('validates each INR plan amount, interval and seven-day Plus-only trial terms', () => {
    for (const [key, period, amount, trial] of [
      ['plus_monthly', 'monthly', 24900, 7],
      ['plus_annual', 'yearly', 149900, 7],
      ['pro_monthly', 'monthly', 49900, 0],
      ['pro_annual', 'yearly', 249900, 0],
    ] as const) {
      const plan = { period, interval: 1, item: { currency: 'INR', amount } };
      expect(verifiedRazorpayPlan(key, plan)).toMatchObject({
        amount: amount / 100,
        currency: 'INR',
        trialDays: trial,
      });
      for (const patch of [
        { interval: 3 },
        { period: 'weekly' },
        { item: { currency: 'USD', amount } },
        { item: { currency: 'INR', amount: amount - 1 } },
      ])
        expect(() => verifiedRazorpayPlan(key, { ...plan, ...patch })).toThrow(
          'RAZORPAY_PLAN_MISMATCH',
        );
    }
  });
  it('rejects missing and invalid provider billing timestamps', () => {
    for (const value of [null, 0, -1, '1900000000', NaN, Infinity, 1e12])
      expect(razorpayEpoch(value)).toBeNull();
    expect(razorpayEpoch(1900000000)).toBe('2030-03-17T17:46:40.000Z');
  });
});
