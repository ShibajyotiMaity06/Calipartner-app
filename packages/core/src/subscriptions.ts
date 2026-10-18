import type {
  Entitlement,
  EntitlementStatus,
  PaywallTrigger,
  PaywallTriggerData,
  RemoteConfigMap,
  RoomPeriod,
  RoomTier,
} from './types';

export {
  canCreateRoom,
  hasPlan,
  hasPremium,
  hasRoomAccess,
  roomCap,
  roomIsUsable,
  isTrialEligible,
  evaluateRoomState,
} from './rooms';

// -----------------------------------------------------------------------------
// 1. REVENUECAT PRODUCT IDENTIFIERS & MAPPINGS (PRD 6.18 SUB-2, SUB-11)
// -----------------------------------------------------------------------------

export const BASIC_PRODUCTS = Object.freeze({
  monthly: 'basic_monthly',
  quarterly: 'basic_quarterly',
  annual: 'basic_annual',
} as const);

export const PLUS_PRODUCTS = Object.freeze({
  monthly: 'plus_monthly',
  quarterly: 'plus_quarterly',
  annual: 'plus_annual',
} as const);

export const PRO_PRODUCTS = Object.freeze({
  monthly: 'pro_monthly',
  quarterly: 'pro_quarterly',
  annual: 'pro_annual',
} as const);

export const REVENUECAT_PRODUCT_IDS: readonly string[] = Object.freeze([
  BASIC_PRODUCTS.monthly,
  BASIC_PRODUCTS.quarterly,
  BASIC_PRODUCTS.annual,
  PLUS_PRODUCTS.monthly,
  PLUS_PRODUCTS.quarterly,
  PLUS_PRODUCTS.annual,
  PRO_PRODUCTS.monthly,
  PRO_PRODUCTS.quarterly,
  PRO_PRODUCTS.annual,
]);

export const REVENUECAT_OFFERING_IDS: Record<
  Exclude<RoomTier, 'community'>,
  string
> = Object.freeze({
  basic: 'basic',
  plus: 'plus',
  pro: 'pro',
});

export const SUBSCRIPTION_GROUP_IDENTIFIER = 'calipartner_room_plans';

// -----------------------------------------------------------------------------
// 2. TIER RANKINGS & COMPARISONS (Basic < Plus < Pro < Community)
// -----------------------------------------------------------------------------

export const TIER_RANKS: Record<RoomTier, number> = Object.freeze({
  basic: 1,
  plus: 2,
  pro: 3,
  community: 4,
});

export function compareTiers(a: RoomTier, b: RoomTier): number {
  return (TIER_RANKS[a] ?? 0) - (TIER_RANKS[b] ?? 0);
}

export function isTierUpgrade(currentTier: RoomTier, targetTier: RoomTier): boolean {
  return compareTiers(targetTier, currentTier) > 0;
}

export function isTierDowngrade(currentTier: RoomTier, targetTier: RoomTier): boolean {
  return compareTiers(targetTier, currentTier) < 0;
}

export function getNextHigherTier(currentTier: RoomTier): RoomTier {
  if (currentTier === 'basic') return 'plus';
  if (currentTier === 'plus') return 'pro';
  return 'community';
}

// -----------------------------------------------------------------------------
// 3. PRODUCT ID PARSER
// -----------------------------------------------------------------------------

export function mapProductIdToTierAndPeriod(
  productId: string,
): { tier: RoomTier; period: RoomPeriod } | null {
  if (!productId || typeof productId !== 'string') return null;

  const normalized = productId.toLowerCase();

  let tier: RoomTier | null = null;
  if (normalized.includes('community')) {
    tier = 'community';
  } else if (normalized.includes('pro')) {
    tier = 'pro';
  } else if (normalized.includes('plus')) {
    tier = 'plus';
  } else if (normalized.includes('basic')) {
    tier = 'basic';
  }

  let period: RoomPeriod | null = null;
  if (
    normalized.includes('annual') ||
    normalized.includes('yearly') ||
    normalized.includes('year')
  ) {
    period = 'annual';
  } else if (
    normalized.includes('quarterly') ||
    normalized.includes('three_month') ||
    normalized.includes('3month') ||
    normalized.includes('3_month')
  ) {
    period = 'quarterly';
  } else if (normalized.includes('monthly') || normalized.includes('month')) {
    period = 'monthly';
  }

  if (tier && period) {
    return { tier, period };
  }

  return null;
}

// -----------------------------------------------------------------------------
// 4. REMOTE CONFIGURATION (PRD 6.8 ROOM-1, 6.18 SUB-2, 7.11)
// -----------------------------------------------------------------------------

export const DEFAULT_REMOTE_CONFIG: RemoteConfigMap = Object.freeze({
  room_caps: Object.freeze({
    basic: 5,
    plus: 20,
    pro: 50,
    community: 100,
  }),
  trial_length_days: 3,
  trial_cap: 5,
  community_tier_enabled: false,
});

export function getTierCap(tier: RoomTier, config?: Partial<RemoteConfigMap> | null): number {
  if (config?.room_caps && config.room_caps[tier]) {
    return config.room_caps[tier];
  }
  return DEFAULT_REMOTE_CONFIG.room_caps[tier] ?? 5;
}

// -----------------------------------------------------------------------------
// 5. WEBHOOK AUTHENTICATION & IDEMPOTENCY
// -----------------------------------------------------------------------------

export function verifyWebhookAuth(
  authHeader: string | null | undefined,
  expectedSecret: string,
): boolean {
  if (!authHeader || !expectedSecret) return false;
  const trimmedSecret = expectedSecret.trim();
  if (trimmedSecret.length === 0) return false;

  const cleanHeader = authHeader.replace(/^Bearer\s+/i, '').trim();
  return cleanHeader === trimmedSecret;
}

export function mapWebhookEventToEntitlementStatus(
  eventType: string,
  currentStatus?: EntitlementStatus,
): EntitlementStatus {
  switch (eventType) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'PRODUCT_CHANGE':
    case 'UNCANCELLATION':
    case 'SUBSCRIPTION_EXTENDED':
      return 'paid';

    case 'BILLING_ISSUE':
      return 'grace';

    case 'CANCELLATION':
      // Cancellation means auto-renewal stopped, access remains paid until period_end
      return currentStatus === 'grace' ? 'grace' : 'paid';

    case 'EXPIRATION':
    case 'REVOCATION':
      return 'lapsed';

    default:
      return currentStatus ?? 'paid';
  }
}

export function isEventNewer(
  incomingTimestamp: number | Date | string,
  existingTimestamp?: number | Date | string | null,
): boolean {
  if (!existingTimestamp) return true;
  const inMs = new Date(incomingTimestamp).getTime();
  const exMs = new Date(existingTimestamp).getTime();
  return inMs >= exMs;
}

// -----------------------------------------------------------------------------
// 6. TWO SUBSCRIPTIONS FOR ONE ROOM RESOLUTION (PRD 7.11)
// "When two people both pay for the same room, the higher tier counts and the
// other subscription is shown in Me as unattached with a prompt to cancel it."
// -----------------------------------------------------------------------------

export function reconcileRoomSubscriptions(subscriptions: Entitlement[]): {
  active: Entitlement | null;
  unattached: Entitlement[];
} {
  if (!subscriptions || subscriptions.length === 0) {
    return { active: null, unattached: [] };
  }

  // Filter to active/grace plans
  const eligible = subscriptions.filter((s) => {
    if (s.status !== 'paid' && s.status !== 'grace') return false;
    if (!s.period_end) return true;
    return new Date(s.period_end).getTime() > Date.now();
  });

  if (eligible.length === 0) {
    return { active: null, unattached: [] };
  }

  // Sort: highest tier first, then furthest period_end, then oldest created_at
  const sorted = [...eligible].sort((a, b) => {
    const rankA = TIER_RANKS[a.tier ?? 'basic'] ?? 1;
    const rankB = TIER_RANKS[b.tier ?? 'basic'] ?? 1;
    if (rankB !== rankA) return rankB - rankA;

    const endA = a.period_end ? new Date(a.period_end).getTime() : Number.MAX_SAFE_INTEGER;
    const endB = b.period_end ? new Date(b.period_end).getTime() : Number.MAX_SAFE_INTEGER;
    if (endB !== endA) return endB - endA;

    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return createdA - createdB;
  });

  const winner = sorted[0];
  if (!winner) {
    return { active: null, unattached: [] };
  }
  const active: Entitlement = { ...winner, is_unattached: false };
  const unattached: Entitlement[] = sorted.slice(1).map((sub) => ({
    ...sub,
    is_unattached: true,
  }));

  return { active, unattached };
}

// -----------------------------------------------------------------------------
// 7. PAYWALL TRIGGERS AS DATA (PRD 6.18 SUB-9)
// -----------------------------------------------------------------------------

export const PAYWALL_TRIGGER_METADATA: Record<
  PaywallTrigger,
  Omit<PaywallTriggerData, 'trigger'>
> = Object.freeze({
  create_room_after_trial: {
    title: 'Start your Room Plan',
    subtitle: 'Your 3-day trial has ended. Keep tracking together with your friends.',
    suggestedTier: 'basic',
    allowsTrial: false,
  },
  add_member_beyond_cap: {
    title: 'Need room for more friends?',
    subtitle: 'Upgrade your room plan to add more members.',
    suggestedTier: 'plus',
    allowsTrial: false,
  },
  sponsor_locked_room: {
    title: 'Keep this room going',
    subtitle: 'Sponsor this room with any plan to unlock it for all members.',
    suggestedTier: 'basic',
    allowsTrial: false,
  },
  open_ai_coach: {
    title: 'CaliPartner AI Coach',
    subtitle: 'Personalized guidance using your actual targets and data. Requires an active plan.',
    suggestedTier: 'basic',
    allowsTrial: false,
  },
  open_partner_finder: {
    title: 'Find Your Partner',
    subtitle: 'Meet real, goal-aligned workout and diet partners. Requires an active plan.',
    suggestedTier: 'basic',
    allowsTrial: false,
  },
});

export function getPaywallTriggerData(
  trigger: PaywallTrigger,
  currentTier?: RoomTier,
): PaywallTriggerData {
  const meta = PAYWALL_TRIGGER_METADATA[trigger];
  let suggested = meta.suggestedTier;
  if (trigger === 'add_member_beyond_cap' && currentTier) {
    suggested = getNextHigherTier(currentTier);
  }
  return {
    trigger,
    title: meta.title,
    subtitle: meta.subtitle,
    suggestedTier: suggested,
    allowsTrial: meta.allowsTrial,
  };
}

export function shouldShowPaywallForInvite(isInvited: boolean): boolean {
  // PRD 6.18 SUB-9: "Invited people are never shown a paywall to join a room."
  return !isInvited;
}

export function getTrialBannerInfo(
  trialStartedAt: string | Date | null | undefined,
  now: Date = new Date(),
): { showBanner: boolean; daysRemaining: number } | null {
  if (!trialStartedAt) return null;
  const startMs = new Date(trialStartedAt).getTime();
  const nowMs = now.getTime();
  const elapsedMs = nowMs - startMs;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const threeDaysMs = 3 * oneDayMs;

  if (elapsedMs < 0 || elapsedMs >= threeDaysMs) {
    return null; // Trial hasn't started or has expired
  }

  const elapsedDays = Math.floor(elapsedMs / oneDayMs); // 0 = day 1, 1 = day 2, 2 = day 3
  const daysRemaining = 3 - elapsedDays;

  // PRD 6.18 SUB-9: "Soft banners show on trial days 2 and 3."
  if (elapsedDays === 1 || elapsedDays === 2) {
    return {
      showBanner: true,
      daysRemaining,
    };
  }

  return {
    showBanner: false,
    daysRemaining: 3,
  };
}
