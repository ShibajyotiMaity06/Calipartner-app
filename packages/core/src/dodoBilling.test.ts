import { describe, expect, it } from 'vitest';
import { dodoProductKey, dodoSubscriptionEvent, type DodoSubscription } from './dodoBilling';
const subscription: DodoSubscription = {
  subscription_id: 'sub_test',
  product_id: 'pdt_test',
  customer: { customer_id: 'cus_test' },
  status: 'active',
  next_billing_date: '2099-01-01',
};
describe('Dodo subscription verification', () => {
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
