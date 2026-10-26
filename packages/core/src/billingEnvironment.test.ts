import { describe, expect, it } from 'vitest';
import { shouldApplyRevenueCatEvent } from './subscriptions';
describe('billing event environment isolation', () => {
  it.each(['APP_STORE', 'PLAY_STORE', 'RC_BILLING'])(
    'accepts production %s transactions',
    (store) => {
      expect(shouldApplyRevenueCatEvent({ store, environment: 'PRODUCTION' })).toBe(true);
    },
  );
  it('rejects simulated stores even if production is claimed or sandbox is allowed', () => {
    expect(shouldApplyRevenueCatEvent({ store: 'TEST_STORE', environment: 'PRODUCTION' })).toBe(
      false,
    );
    expect(shouldApplyRevenueCatEvent({ store: 'TEST_STORE', environment: 'SANDBOX' }, true)).toBe(
      false,
    );
  });
  it('rejects missing environments and unknown stores; only an isolated backend can opt into sandbox', () => {
    expect(shouldApplyRevenueCatEvent({ store: 'RC_BILLING' })).toBe(false);
    expect(shouldApplyRevenueCatEvent({ store: 'unknown', environment: 'PRODUCTION' })).toBe(false);
    expect(shouldApplyRevenueCatEvent({ store: 'RC_BILLING', environment: 'SANDBOX' })).toBe(false);
    expect(shouldApplyRevenueCatEvent({ store: 'RC_BILLING', environment: 'SANDBOX' }, true)).toBe(
      true,
    );
  });
});
