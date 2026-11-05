import { expect, it } from 'vitest';
import {
  hasSubscriptionAccess,
  isCardlessPlusTrial,
  plusTrialRemainingMs,
  type PlusTrialOffer,
} from './subscriptions';
import type { Entitlement } from './types';
const now = new Date('2026-11-05T12:00:00Z');
const trial: Entitlement = {
  user_id: 'owner',
  source: 'none',
  tier: 'plus',
  status: 'trial',
  period_end: '2026-11-12T12:00:00Z',
};
it('grants only Plus for a live cardless trial and ends access at the exact deadline', () => {
  expect(isCardlessPlusTrial(trial, now)).toBe(true);
  expect(hasSubscriptionAccess(trial, now)).toBe(true);
  expect(hasSubscriptionAccess(trial, new Date(trial.period_end!))).toBe(false);
  expect(hasSubscriptionAccess({ ...trial, tier: 'pro' }, now)).toBe(false);
  expect(isCardlessPlusTrial({ ...trial, source: 'razorpay' }, now)).toBe(false);
  expect(
    hasSubscriptionAccess({ ...trial, source: 'apple', status: 'paid', tier: 'pro' }, now),
  ).toBe(true);
});
it('uses the server deadline for the presentation timer and never schedules longer than seven days', () => {
  const offer: PlusTrialOffer = {
    eligible: false,
    active: true,
    expired: false,
    started_at: now.toISOString(),
    ends_at: trial.period_end!,
    claim_id: 'claim',
    server_now: now.toISOString(),
  };
  expect(plusTrialRemainingMs(offer)).toBe(604800000);
  expect(plusTrialRemainingMs({ ...offer, active: false })).toBe(0);
  expect(plusTrialRemainingMs({ ...offer, server_now: trial.period_end! })).toBe(0);
  expect(plusTrialRemainingMs({ ...offer, server_now: 'bad' })).toBe(0);
});
