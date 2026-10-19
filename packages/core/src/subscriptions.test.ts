import { describe, expect, it } from 'vitest';
import {
  BASIC_PRODUCTS,
  compareTiers,
  DEFAULT_REMOTE_CONFIG,
  getNextHigherTier,
  getTierCap,
  getTrialBannerInfo,
  isEventNewer,
  isTierDowngrade,
  isTierUpgrade,
  mapProductIdToTierAndPeriod,
  mapWebhookEventToEntitlementStatus,
  PLUS_PRODUCTS,
  PRO_PRODUCTS,
  reconcileRoomSubscriptions,
  REVENUECAT_PRODUCT_IDS,
  shouldShowPaywallForInvite,
  TIER_RANKS,
  verifyWebhookAuth,
  getPaywallTriggerData,
  PRICING_PLANS,
  isFeatureAllowed,
  getRequiredTierForFeature,
} from './subscriptions';
import type { Entitlement } from './types';

describe('Phase 10 Core: Subscriptions, Offerings, Tiers & Periods', () => {
  it('defines exactly nine products across 3 tiers and 3 durations', () => {
    expect(REVENUECAT_PRODUCT_IDS).toHaveLength(9);
    expect(REVENUECAT_PRODUCT_IDS).toContain('basic_monthly');
    expect(REVENUECAT_PRODUCT_IDS).toContain('basic_quarterly');
    expect(REVENUECAT_PRODUCT_IDS).toContain('basic_annual');
    expect(REVENUECAT_PRODUCT_IDS).toContain('plus_monthly');
    expect(REVENUECAT_PRODUCT_IDS).toContain('plus_quarterly');
    expect(REVENUECAT_PRODUCT_IDS).toContain('plus_annual');
    expect(REVENUECAT_PRODUCT_IDS).toContain('pro_monthly');
    expect(REVENUECAT_PRODUCT_IDS).toContain('pro_quarterly');
    expect(REVENUECAT_PRODUCT_IDS).toContain('pro_annual');
  });

  it('correctly parses store product IDs to tier and period', () => {
    expect(mapProductIdToTierAndPeriod(BASIC_PRODUCTS.monthly)).toEqual({
      tier: 'basic',
      period: 'monthly',
    });
    expect(mapProductIdToTierAndPeriod(BASIC_PRODUCTS.quarterly)).toEqual({
      tier: 'basic',
      period: 'quarterly',
    });
    expect(mapProductIdToTierAndPeriod(BASIC_PRODUCTS.annual)).toEqual({
      tier: 'basic',
      period: 'annual',
    });

    expect(mapProductIdToTierAndPeriod(PLUS_PRODUCTS.monthly)).toEqual({
      tier: 'plus',
      period: 'monthly',
    });
    expect(mapProductIdToTierAndPeriod(PLUS_PRODUCTS.quarterly)).toEqual({
      tier: 'plus',
      period: 'quarterly',
    });
    expect(mapProductIdToTierAndPeriod(PLUS_PRODUCTS.annual)).toEqual({
      tier: 'plus',
      period: 'annual',
    });

    expect(mapProductIdToTierAndPeriod(PRO_PRODUCTS.monthly)).toEqual({
      tier: 'pro',
      period: 'monthly',
    });
    expect(mapProductIdToTierAndPeriod(PRO_PRODUCTS.quarterly)).toEqual({
      tier: 'pro',
      period: 'quarterly',
    });
    expect(mapProductIdToTierAndPeriod(PRO_PRODUCTS.annual)).toEqual({
      tier: 'pro',
      period: 'annual',
    });

    // Variations
    expect(mapProductIdToTierAndPeriod('calipartner_pro_annual_store')).toEqual({
      tier: 'pro',
      period: 'annual',
    });
    expect(mapProductIdToTierAndPeriod('plus_three_month')).toEqual({
      tier: 'plus',
      period: 'quarterly',
    });

    // Unknown product id returns null
    expect(mapProductIdToTierAndPeriod('invalid_product')).toBeNull();
  });

  it('ranks tiers Basic < Plus < Pro < Community', () => {
    expect(TIER_RANKS.basic).toBeLessThan(TIER_RANKS.plus);
    expect(TIER_RANKS.plus).toBeLessThan(TIER_RANKS.pro);
    expect(TIER_RANKS.pro).toBeLessThan(TIER_RANKS.community);

    expect(compareTiers('basic', 'plus')).toBeLessThan(0);
    expect(compareTiers('pro', 'plus')).toBeGreaterThan(0);
    expect(compareTiers('pro', 'pro')).toBe(0);

    expect(isTierUpgrade('basic', 'plus')).toBe(true);
    expect(isTierUpgrade('plus', 'pro')).toBe(true);
    expect(isTierUpgrade('pro', 'basic')).toBe(false);

    expect(isTierDowngrade('pro', 'plus')).toBe(true);
    expect(isTierDowngrade('plus', 'basic')).toBe(true);
    expect(isTierDowngrade('basic', 'pro')).toBe(false);

    expect(getNextHigherTier('basic')).toBe('plus');
    expect(getNextHigherTier('plus')).toBe('pro');
    expect(getNextHigherTier('pro')).toBe('community');
  });

  it('reads remote config caps with fallback to defaults (Plus 10, Pro 20)', () => {
    expect(getTierCap('basic')).toBe(5);
    expect(getTierCap('plus')).toBe(10);
    expect(getTierCap('pro')).toBe(20);

    const customConfig = {
      room_caps: { basic: 6, plus: 25, pro: 60, community: 120 },
    };
    expect(getTierCap('basic', customConfig)).toBe(6);
    expect(getTierCap('plus', customConfig)).toBe(25);
    expect(getTierCap('pro', customConfig)).toBe(60);

    expect(DEFAULT_REMOTE_CONFIG.community_tier_enabled).toBe(false);
    expect(DEFAULT_REMOTE_CONFIG.trial_length_days).toBe(7);
    expect(DEFAULT_REMOTE_CONFIG.trial_cap).toBe(10);
  });
});

describe('Phase 10 Core: Webhook Verification & State Transitions', () => {
  it('verifies webhook authorization header securely', () => {
    const secret = 'rc_webhook_secret_98765';

    expect(verifyWebhookAuth(`Bearer ${secret}`, secret)).toBe(true);
    expect(verifyWebhookAuth(secret, secret)).toBe(true);
    expect(verifyWebhookAuth('Bearer wrong_secret', secret)).toBe(false);
    expect(verifyWebhookAuth(null, secret)).toBe(false);
    expect(verifyWebhookAuth('', secret)).toBe(false);
    expect(verifyWebhookAuth('Bearer ', secret)).toBe(false);
  });

  it('maps webhook event types to correct entitlement statuses', () => {
    expect(mapWebhookEventToEntitlementStatus('INITIAL_PURCHASE')).toBe('paid');
    expect(mapWebhookEventToEntitlementStatus('RENEWAL')).toBe('paid');
    expect(mapWebhookEventToEntitlementStatus('PRODUCT_CHANGE')).toBe('paid');
    expect(mapWebhookEventToEntitlementStatus('UNCANCELLATION')).toBe('paid');
    expect(mapWebhookEventToEntitlementStatus('SUBSCRIPTION_EXTENDED')).toBe('paid');

    // Billing issue maps to grace
    expect(mapWebhookEventToEntitlementStatus('BILLING_ISSUE')).toBe('grace');

    // Cancellation: remains paid until expiration
    expect(mapWebhookEventToEntitlementStatus('CANCELLATION', 'paid')).toBe('paid');
    expect(mapWebhookEventToEntitlementStatus('CANCELLATION', 'grace')).toBe('grace');

    // Expiration and refund (revocation) map to lapsed
    expect(mapWebhookEventToEntitlementStatus('EXPIRATION')).toBe('lapsed');
    expect(mapWebhookEventToEntitlementStatus('REVOCATION')).toBe('lapsed');
  });

  it('handles out-of-order webhook detection using timestamps', () => {
    const t1 = new Date('2026-10-10T10:00:00Z');
    const t2 = new Date('2026-10-10T11:00:00Z');

    expect(isEventNewer(t2, t1)).toBe(true);
    expect(isEventNewer(t1, t2)).toBe(false);
    expect(isEventNewer(t1, null)).toBe(true);
  });
});

describe('Phase 10 Core: Two Subscriptions for One Room (PRD 7.11)', () => {
  it('resolves two subscriptions on the same room: higher tier counts, other flagged unattached', () => {
    const now = Date.now();
    const future = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();

    const subAlex: Entitlement = {
      user_id: 'user-alex',
      tier: 'plus', // cap 20
      period: 'monthly',
      source: 'apple',
      status: 'paid',
      attached_room_id: 'room-1',
      period_end: future,
      created_at: new Date(now - 1000).toISOString(),
    };

    const subBob: Entitlement = {
      user_id: 'user-bob',
      tier: 'pro', // cap 50 (higher!)
      period: 'monthly',
      source: 'google',
      status: 'paid',
      attached_room_id: 'room-1',
      period_end: future,
      created_at: new Date(now).toISOString(),
    };

    const result = reconcileRoomSubscriptions([subAlex, subBob]);

    expect(result.active).not.toBeNull();
    expect(result.active?.user_id).toBe('user-bob'); // Pro won
    expect(result.active?.tier).toBe('pro');
    expect(result.active?.is_unattached).toBe(false);

    expect(result.unattached).toHaveLength(1);
    expect(result.unattached[0]!.user_id).toBe('user-alex');
    expect(result.unattached[0]!.is_unattached).toBe(true);
  });

  it('resolves equal tier subscriptions by later period_end', () => {
    const now = Date.now();
    const endSoon = new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString();
    const endLater = new Date(now + 60 * 24 * 60 * 60 * 1000).toISOString();

    const sub1: Entitlement = {
      user_id: 'user-1',
      tier: 'basic',
      period: 'monthly',
      source: 'apple',
      status: 'paid',
      attached_room_id: 'room-1',
      period_end: endSoon,
    };

    const sub2: Entitlement = {
      user_id: 'user-2',
      tier: 'basic',
      period: 'quarterly',
      source: 'google',
      status: 'paid',
      attached_room_id: 'room-1',
      period_end: endLater,
    };

    const result = reconcileRoomSubscriptions([sub1, sub2]);
    expect(result.active?.user_id).toBe('user-2');
    expect(result.active?.is_unattached).toBe(false);
    expect(result.unattached[0]!.user_id).toBe('user-1');
    expect(result.unattached[0]!.is_unattached).toBe(true);
  });
});

describe('Phase 10 Core: Paywall Triggers & Trial Banners (CaliPartner Pricing Plan v2)', () => {
  it('provides structured data for paywall triggers with Plus and Pro tiers', () => {
    const t1 = getPaywallTriggerData('create_room_after_trial');
    expect(t1.suggestedTier).toBe('plus');
    expect(t1.allowsTrial).toBe(false);

    const t2 = getPaywallTriggerData('add_member_beyond_cap', 'plus');
    expect(t2.suggestedTier).toBe('pro'); // suggests Pro for up to 20 members!

    const t3 = getPaywallTriggerData('sponsor_locked_room');
    expect(t3.suggestedTier).toBe('plus');

    const t4 = getPaywallTriggerData('open_ai_coach');
    expect(t4.suggestedTier).toBe('pro');

    const t5 = getPaywallTriggerData('open_partner_finder');
    expect(t5.suggestedTier).toBe('plus');

    const t6 = getPaywallTriggerData('accept_room_invite');
    expect(t6.suggestedTier).toBe('plus');
    expect(t6.allowsTrial).toBe(true);

    const t7 = getPaywallTriggerData('ai_photo_scan');
    expect(t7.suggestedTier).toBe('pro');
  });

  it('correctly gates invited users based on their plan (free users see paywall, paying users do not)', () => {
    // When free user accepts invite: prompt towards pricing page (Plus or Pro)
    expect(shouldShowPaywallForInvite(true, false)).toBe(true);

    // When paying/trial user accepts invite: joins directly without paywall
    expect(shouldShowPaywallForInvite(true, true)).toBe(false);

    // Non-invited users without invite see paywall
    expect(shouldShowPaywallForInvite(false, false)).toBe(true);
    expect(shouldShowPaywallForInvite(false, true)).toBe(true);

    // Legacy fallback
    expect(shouldShowPaywallForInvite(true)).toBe(false);
    expect(shouldShowPaywallForInvite(false)).toBe(true);
  });

  it('shows soft trial banner on days 2 and 3 for 3-day legacy trial, and <=3 days left for 7-day trial', () => {
    const base = new Date('2026-10-10T12:00:00Z');

    // 3-day trial legacy
    const day1 = new Date('2026-10-10T18:00:00Z');
    expect(getTrialBannerInfo(base, day1, 3)).toEqual({
      showBanner: false,
      daysRemaining: 3,
    });

    const day2 = new Date('2026-10-11T18:00:00Z');
    expect(getTrialBannerInfo(base, day2, 3)).toEqual({
      showBanner: true,
      daysRemaining: 2,
    });

    // 7-day trial
    const day5 = new Date('2026-10-15T18:00:00Z'); // 5 days elapsed, 2 days remaining
    expect(getTrialBannerInfo(base, day5, 7)).toEqual({
      showBanner: true,
      daysRemaining: 2,
    });
  });

  it('validates Pricing Plans v2 (Plus ₹99/₹599 cap 10, Pro ₹199/₹1,199 cap 20)', () => {
    expect(PRICING_PLANS.plus.roomCap).toBe(10);
    expect(PRICING_PLANS.plus.rawMonthly).toBe(99);
    expect(PRICING_PLANS.plus.rawAnnual).toBe(599);

    expect(PRICING_PLANS.pro.roomCap).toBe(20);
    expect(PRICING_PLANS.pro.rawMonthly).toBe(199);
    expect(PRICING_PLANS.pro.rawAnnual).toBe(1199);
    expect(PRICING_PLANS.pro.aiScansPerDay).toBe(5);
    expect(PRICING_PLANS.pro.aiCoachMessagesPerDay).toBe(10);
  });

  it('enforces feature permissions matrix across Free, Plus, and Pro', () => {
    // Free features
    expect(isFeatureAllowed('food_search', 'free')).toBe(true);
    expect(isFeatureAllowed('gps_tracking', 'free')).toBe(true);
    expect(isFeatureAllowed('water_tracking', 'free')).toBe(true);
    expect(isFeatureAllowed('steps_distance', 'free')).toBe(true);
    expect(isFeatureAllowed('open_to_partner', 'free')).toBe(true);
    expect(getRequiredTierForFeature('food_search')).toBe('free');

    // Plus features
    expect(isFeatureAllowed('create_room', 'free')).toBe(false);
    expect(isFeatureAllowed('create_room', 'plus')).toBe(true);
    expect(isFeatureAllowed('create_room', 'pro')).toBe(true);
    expect(isFeatureAllowed('fasting_tracker', 'free')).toBe(false);
    expect(isFeatureAllowed('fasting_tracker', 'plus')).toBe(true);
    expect(isFeatureAllowed('partner_finder_browse', 'free')).toBe(false);
    expect(isFeatureAllowed('partner_finder_browse', 'plus')).toBe(true);

    // Pro features
    expect(isFeatureAllowed('ai_coach', 'free')).toBe(false);
    expect(isFeatureAllowed('ai_coach', 'plus')).toBe(false);
    expect(isFeatureAllowed('ai_coach', 'pro')).toBe(true);
    expect(isFeatureAllowed('chat_to_log', 'plus')).toBe(false);
    expect(isFeatureAllowed('chat_to_log', 'pro')).toBe(true);

    // Free AI photo scans taste (3 scans)
    expect(isFeatureAllowed('ai_photo_logging', 'free', { freeScansRemaining: 3 })).toBe(true);
    expect(isFeatureAllowed('ai_photo_logging', 'free', { freeScansRemaining: 0 })).toBe(false);
  });
});
