import { describe, expect, it } from 'vitest';
import {
  dodoProductKey,
  dodoSubscriptionEvent,
  verifiedDodoProduct,
  type DodoSubscription,
} from './dodoBilling';
const subscription: DodoSubscription = {
  subscription_id: 'sub_test',
  product_id: 'pdt_test',
  customer: { customer_id: 'cus_test' },
  status: 'active',
  next_billing_date: '2099-01-01',
};
describe('Dodo subscription verification', () => {
  const product = {
    is_recurring: true,
    price: {
      type: 'recurring_price',
      currency: 'INR',
      price: 249900,
      payment_frequency_count: 1,
      payment_frequency_interval: 'Year',
      trial_period_days: 0,
      tax_inclusive: true,
    },
  };
  it('verifies the approved recurring price before checkout', () => {
    expect(verifiedDodoProduct('pro_annual', product)).toEqual({
      key: 'pro_annual',
      currency: 'INR',
      amount: 2499,
      trialDays: 0,
    });
  });
  it.each([
    { currency: 'USD' },
    { tax_inclusive: false },
    { price: 119900 },
    { trial_period_days: 7 },
    { payment_frequency_interval: 'Month' },
    { payment_frequency_count: 2 },
  ])('blocks a misconfigured product: %j', (change) => {
    expect(() =>
      verifiedDodoProduct('pro_annual', { ...product, price: { ...product.price, ...change } }),
    ).toThrow('DODO_PRODUCT_MISMATCH');
  });
  it.each([
    ['plus_annual', 'Year', 1, 2999],
    ['plus_semiannual', 'Month', 6, 1999],
    ['plus_quarterly', 'Month', 3, 1199],
    ['pro_annual', 'Year', 1, 4999],
    ['pro_semiannual', 'Month', 6, 3299],
    ['pro_quarterly', 'Month', 3, 1899],
  ] as const)(
    'validates the %s USD checkout product without a trial',
    (key, unit, count, price) => {
      const terms = {
        ...product.price,
        currency: 'USD',
        price,
        payment_frequency_count: count,
        payment_frequency_interval: unit,
      };
      expect(verifiedDodoProduct(key, { ...product, price: terms })).toEqual({
        key,
        currency: 'USD',
        amount: price / 100,
        trialDays: 0,
      });
      expect(() =>
        verifiedDodoProduct(key, {
          ...product,
          price: { ...terms, trial_period_days: 7, trial_type: 'free' },
        }),
      ).toThrow('DODO_PRODUCT_MISMATCH');
    },
  );
  it('allows the offered terms and rejects new monthly checkout', () => {
    expect(dodoProductKey('pro', 'annual')).toBe('pro_annual');
    expect(dodoProductKey('plus', 'semiannual')).toBeNull();
    expect(dodoProductKey('plus', 'monthly')).toBeNull();
    expect(dodoProductKey('free', 'annual')).toBeNull();
    expect(dodoProductKey('pro', 'quarterly')).toBe('pro_quarterly');
  });
  it('requires a verified active subscription with a real billing deadline', () => {
    expect(dodoSubscriptionEvent(subscription).eventType).toBe('INITIAL_PURCHASE');
    expect(() => dodoSubscriptionEvent({ ...subscription, next_billing_date: 'invalid' })).toThrow(
      'INVALID_DODO_PERIOD',
    );
  });
  it.each(['pending', 'failed', 'on_hold', 'cancelled', 'expired', 'paused'])(
    'never grants access for %s status',
    (status) => {
      expect(dodoSubscriptionEvent({ ...subscription, status }).eventType).toBe('EXPIRATION');
    },
  );
  it('retains paid-through access for scheduled cancellation and revokes refunds', () => {
    expect(
      dodoSubscriptionEvent({ ...subscription, cancel_at_next_billing_date: true }).eventType,
    ).toBe('CANCELLATION');
    expect(dodoSubscriptionEvent(subscription, true).eventType).toBe('REVOCATION');
  });
});
