import { describe, expect, it } from 'vitest';
import {
  isFeatureAllowed,
  verifyWebhookAuth,
  isEventNewer,
  PRICING_PLANS,
  mapProductIdToTierAndPeriod,
} from './subscriptions';

// Real membership, RPC, RLS, webhook replay and lifecycle tests live in test:db.
describe('Individual subscription security boundaries', () => {
  it('requires the sender to pay for text or workout sharing', () => {
    expect(isFeatureAllowed('room_chat', 'free')).toBe(false);
    expect(isFeatureAllowed('shared_workouts', 'free')).toBe(false);
    expect(isFeatureAllowed('room_chat', 'plus')).toBe(true);
    expect(isFeatureAllowed('shared_workouts', 'plus')).toBe(true);
    expect(isFeatureAllowed('create_room', 'free')).toBe(true);
    expect(isFeatureAllowed('join_room', 'free')).toBe(true);
  });
  it('never grants Pro media or monthly reviews to a Plus trial', () => {
    expect(isFeatureAllowed('chat_media', 'plus', { hasActiveTrial: true })).toBe(false);
    expect(isFeatureAllowed('monthly_plan_review', 'plus', { hasActiveTrial: true })).toBe(false);
    expect(isFeatureAllowed('chat_media', 'pro')).toBe(true);
    expect(isFeatureAllowed('monthly_plan_review', 'pro')).toBe(true);
    expect(isFeatureAllowed('room_chat', 'free', { hasActiveTrial: true })).toBe(true);
  });
  it('retains prices and existing Pro allowances', () => {
    expect(PRICING_PLANS.plus.rawMonthly).toBe(99);
    expect(PRICING_PLANS.pro.rawAnnual).toBe(1199);
    expect(PRICING_PLANS.pro.aiCoachMessagesPerDay).toBe(10);
    expect(PRICING_PLANS.pro.aiScansPerDay).toBe(5);
    expect(PRICING_PLANS.pro.trialDays).toBe(0);
    expect(PRICING_PLANS.plus.hostedRoomsMax).toBe(2);
    expect(PRICING_PLANS.pro.hostedRoomsMax).toBe(5);
  });
  it('rejects forged and absent webhook authorization', () => {
    expect(verifyWebhookAuth('Bearer forged', 'real-secret')).toBe(false);
    expect(verifyWebhookAuth(null, 'real-secret')).toBe(false);
    expect(verifyWebhookAuth('Bearer real-secret', '')).toBe(false);
    expect(verifyWebhookAuth('Bearer real-secret', 'real-secret')).toBe(true);
  });
  it('rejects older events and accepts equal timestamps and retains product mappings', () => {
    expect(isEventNewer(Date.parse('2026-10-24T12:00:00Z'), '2026-10-24T13:00:00Z')).toBe(false);
    expect(isEventNewer(Date.parse('2026-10-24T13:00:00Z'), '2026-10-24T13:00:00Z')).toBe(true);
    expect(mapProductIdToTierAndPeriod('pro_annual')).toEqual({ tier: 'pro', period: 'annual' });
  });
});
