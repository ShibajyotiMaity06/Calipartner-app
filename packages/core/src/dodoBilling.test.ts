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
    { price: 119900 },
    { trial_period_days: 7 },
    { payment_frequency_interval: 'Month' },
    { payment_frequency_count: 2 },
  ])('blocks a misconfigured product: %j', (change) => {
    expect(() =>
      verifiedDodoProduct('pro_annual', { ...product, price: { ...product.price, ...change } }),
    ).toThrow('DODO_PRODUCT_MISMATCH');
  });
  it('requires a free seven-day Plus trial and supports USD products', () => {
    const plus = {
      ...product,
      price: {
        ...product.price,
        currency: 'USD',
        price: 2999,
        trial_period_days: 7,
        trial_type: 'free',
      },
    };
    expect(verifiedDodoProduct('plus_annual', plus).amount).toBe(29.99);
    expect(() =>
      verifiedDodoProduct('plus_annual', {
        ...plus,
        price: { ...plus.price, trial_type: 'paid', trial_amount: 100 },
      }),
    ).toThrow();
    expect(() => verifiedDodoProduct('plus_annual', null)).toThrow();
  });
  it('accepts only supported tier and duration combinations', () => {
    expect(dodoProductKey('pro', 'annual')).toBe('pro_annual');
    expect(dodoProductKey('plus', 'monthly')).toBe('plus_monthly');
    expect(dodoProductKey('free', 'annual')).toBeNull();
    expect(dodoProductKey('pro', 'quarterly')).toBeNull();
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
