import type {
  AppFeature,
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
// 1. REVENUECAT PRODUCT IDENTIFIERS & MAPPINGS (CaliPartner Pricing Plan v2)
// -----------------------------------------------------------------------------

export const PLUS_PRODUCTS = Object.freeze({
  monthly: 'plus_monthly',
  annual: 'plus_annual',
  yearly: 'plus_yearly',
  quarterly: 'plus_quarterly', // legacy
} as const);

export const PRO_PRODUCTS = Object.freeze({
  monthly: 'pro_monthly',
  annual: 'pro_annual',
  yearly: 'pro_yearly',
  quarterly: 'pro_quarterly', // legacy
} as const);

export const BASIC_PRODUCTS = Object.freeze({
  monthly: 'basic_monthly',
  quarterly: 'basic_quarterly',
  annual: 'basic_annual',
} as const);

export const ACTIVE_REVENUECAT_PRODUCT_IDS: readonly string[] = Object.freeze([
  PLUS_PRODUCTS.monthly,
  PLUS_PRODUCTS.annual,
  PRO_PRODUCTS.monthly,
  PRO_PRODUCTS.annual,
]);

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
  free: 'free',
  basic: 'basic',
  plus: 'plus',
  pro: 'pro',
});

export const SUBSCRIPTION_GROUP_IDENTIFIER = 'calipartner_room_plans';

// -----------------------------------------------------------------------------
// 1b. PRICING PLAN CONSTANTS (v2: Monthly & Annual only, Plus ₹99/₹599, Pro ₹199/₹1199)
// -----------------------------------------------------------------------------

export const PRICING_PLANS = Object.freeze({
  free: {
    name: 'Free',
    inr: { monthly: '₹0', annual: '₹0', perMonthAnnual: '₹0' },
    usd: { monthly: '$0', annual: '$0', perMonthAnnual: '$0' },
    trialDays: 0,
    roomCap: 0,
    hostedRoomsMax: 0,
    aiScansPerDay: 0,
    aiFreeTasteScans: 3,
    aiCoachMessagesPerDay: 0,
  },
  plus: {
    name: 'Plus',
    inr: {
      monthly: '₹99 / mo',
      annual: '₹599 / yr',
      perMonthAnnual: '₹50 / mo',
      rawAnnual: 599,
      rawMonthly: 99,
    },
    usd: {
      monthly: '$5.99 / mo',
      annual: '$39.99 / yr',
      perMonthAnnual: '$3.33 / mo',
      rawAnnual: 39.99,
      rawMonthly: 5.99,
    },
    trialDays: 7,
    roomCap: 10, // Explicit requirement: 10 members for Plus
    hostedRoomsMax: 1,
    rawMonthly: 99,
    rawAnnual: 599,
    aiScansPerDay: 0,
    aiFreeTasteScans: 3,
    aiCoachMessagesPerDay: 0,
  },
  pro: {
    name: 'Pro',
    inr: {
      monthly: '₹199 / mo',
      annual: '₹1,199 / yr',
      perMonthAnnual: '₹100 / mo',
      rawAnnual: 1199,
      rawMonthly: 199,
    },
    usd: {
      monthly: '$11.99 / mo',
      annual: '$79.99 / yr',
      perMonthAnnual: '$6.67 / mo',
      rawAnnual: 79.99,
      rawMonthly: 11.99,
    },
    trialDays: 7,
    roomCap: 20, // Explicit requirement: 20 members for Pro
    hostedRoomsMax: 3,
    rawMonthly: 199,
    rawAnnual: 1199,
    aiScansPerDay: 5,
    aiFreeTasteScans: 3,
    aiCoachMessagesPerDay: 10,
  },
});

// -----------------------------------------------------------------------------
// 2. TIER RANKINGS & COMPARISONS (Free < Basic < Plus < Pro < Community)
// -----------------------------------------------------------------------------

export const TIER_RANKS: Record<RoomTier, number> = Object.freeze({
  free: 0,
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
  if (currentTier === 'free' || currentTier === 'basic') return 'plus';
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
    free: 0,
    basic: 5,
    plus: 10,
    pro: 20,
    community: 20,
  }),
  trial_length_days: 7,
  trial_cap: 10,
  community_tier_enabled: false,
});

export function getTierCap(tier: RoomTier, config?: Partial<RemoteConfigMap> | null): number {
  if (config?.room_caps && config.room_caps[tier] !== undefined) {
    return config.room_caps[tier];
  }
  return DEFAULT_REMOTE_CONFIG.room_caps[tier] ?? (tier === 'pro' ? 20 : tier === 'plus' ? 10 : 5);
}

// -----------------------------------------------------------------------------
// 4b. FEATURE GATING & PERMISSIONS (Section 7 Features Matrix)
// -----------------------------------------------------------------------------

export function getRequiredTierForFeature(feature: AppFeature): 'free' | 'plus' | 'pro' {
  const freeFeatures: AppFeature[] = [
    'food_diary',
    'food_search',
    'barcode_scan',
    'targets',
    'water_tracking',
    'steps_distance',
    'gps_tracking',
    'workout_logging',
    'weight_tracking',
    'personal_graphs',
    'personal_focus',
    'streaks',
    'weekly_leaderboard',
    'starter_recipes',
    'open_to_partner',
    'offline_logging',
    'receive_room_invite',
  ];
  if (freeFeatures.includes(feature)) return 'free';

  const proFeatures: AppFeature[] = [
    'ai_coach',
    'ai_photo_logging',
    'chat_to_log',
    'fits_my_day_recipes',
    'weekly_ai_insights',
    'pro_rooms_capacity',
    'priority_support',
  ];
  if (proFeatures.includes(feature)) return 'pro';

  return 'plus';
}

export function isFeatureAllowed(
  feature: AppFeature,
  userTier: RoomTier = 'free',
  options?: {
    freeScansRemaining?: number;
    hasActiveTrial?: boolean;
  },
): boolean {
  const required = getRequiredTierForFeature(feature);
  if (required === 'free') return true;

  if (feature === 'ai_photo_logging' && (options?.freeScansRemaining ?? 0) > 0) {
    return true; // 3 free starter scans
  }

  if (options?.hasActiveTrial) {
    return true; // Trial grants access
  }

  const userRank = TIER_RANKS[userTier] ?? 0;
  const requiredRank = TIER_RANKS[required] ?? 0;
  return userRank >= requiredRank;
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
// 7. PAYWALL TRIGGERS AS DATA (PRD 6.18 SUB-9, CaliPartner Pricing Plan v2)
// -----------------------------------------------------------------------------

export const PAYWALL_TRIGGER_METADATA: Record<
  PaywallTrigger,
  Omit<PaywallTriggerData, 'trigger'>
> = Object.freeze({
  accept_room_invite: {
    title: 'Join Room with Plus',
    subtitle: 'Joining accountability rooms requires Plus or Pro. Start your 7-day free trial.',
    suggestedTier: 'plus',
    allowsTrial: true,
  },
  create_room: {
    title: 'Host an Accountability Room',
    subtitle: 'Room hosting requires Plus (up to 10 members) or Pro (up to 20 members).',
    suggestedTier: 'plus',
    allowsTrial: true,
  },
  join_room: {
    title: 'Join an Accountability Room',
    subtitle: 'Room participation requires Plus or Pro. Start your 7-day free trial.',
    suggestedTier: 'plus',
    allowsTrial: true,
  },
  create_room_after_trial: {
    title: 'Keep Your Room Active',
    subtitle:
      'Your 7-day free trial has ended. Subscribe to Plus or Pro to keep tracking together.',
    suggestedTier: 'plus',
    allowsTrial: false,
  },
  add_member_beyond_cap: {
    title: 'Need room for more friends?',
    subtitle: 'Plus covers up to 10 members. Upgrade to Pro for up to 20 members.',
    suggestedTier: 'pro',
    allowsTrial: false,
  },
  sponsor_locked_room: {
    title: 'Keep this room going',
    subtitle: 'Sponsor this room with Plus or Pro to unlock it for all members.',
    suggestedTier: 'plus',
    allowsTrial: false,
  },
  open_ai_coach: {
    title: 'CaliPartner AI Coach',
    subtitle: 'Personalized guidance using Claude Haiku 5.5 (10 messages per day). Requires Pro.',
    suggestedTier: 'pro',
    allowsTrial: true,
  },
  open_partner_finder: {
    title: 'Find Your Partner',
    subtitle: 'Browse goal-aligned partners and send requests. Requires Plus.',
    suggestedTier: 'plus',
    allowsTrial: true,
  },
  ai_photo_scan: {
    title: 'AI Food Photo Logging',
    subtitle: 'Instant meal detection from photos (5 scans per day). Requires Pro.',
    suggestedTier: 'pro',
    allowsTrial: true,
  },
  fasting_tracker: {
    title: 'Intermittent Fasting Tracker',
    subtitle: 'Custom eating windows and fasting protocols require CaliPartner Plus.',
    suggestedTier: 'plus',
    allowsTrial: true,
  },
  challenges: {
    title: 'Seasonal & Friend Challenges',
    subtitle: 'Compete in community and 1-on-1 challenges with CaliPartner Plus.',
    suggestedTier: 'plus',
    allowsTrial: true,
  },
  meal_planner: {
    title: 'Meal Planner & Grocery Lists',
    subtitle: 'Plan your weekly nutrition and generate grocery lists with Plus.',
    suggestedTier: 'plus',
    allowsTrial: true,
  },
  workout_routines: {
    title: 'Workout Routines & Programs',
    subtitle: 'Access structured workout programs and rest timers with Plus.',
    suggestedTier: 'plus',
    allowsTrial: true,
  },
  body_measurements: {
    title: 'Body Measurements & Progress Photos',
    subtitle: 'Track private body circumference and photos with Plus.',
    suggestedTier: 'plus',
    allowsTrial: true,
  },
  recipe_library: {
    title: 'Full Recipe Library',
    subtitle: 'Unlock 150+ high-protein and regional Indian recipes with Plus.',
    suggestedTier: 'plus',
    allowsTrial: true,
  },
  extra_nutrients: {
    title: 'Advanced Nutrients',
    subtitle: 'Track fibre, sugar, sodium, and micronutrients with Plus.',
    suggestedTier: 'plus',
    allowsTrial: true,
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

export function shouldShowPaywallForInvite(isInvited: boolean, hasPlan?: boolean): boolean {
  if (hasPlan !== undefined) {
    return isInvited ? !hasPlan : true;
  }
  // Fallback for legacy single-argument calls
  return !isInvited;
}

export function getTrialBannerInfo(
  trialStartedAt: string | Date | null | undefined,
  now: Date = new Date(),
  trialLengthDays = 7,
): { showBanner: boolean; daysRemaining: number } | null {
  if (!trialStartedAt) return null;
  const startMs = new Date(trialStartedAt).getTime();
  const nowMs = now.getTime();
  const elapsedMs = nowMs - startMs;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const totalTrialMs = trialLengthDays * oneDayMs;

  if (elapsedMs < 0 || elapsedMs >= totalTrialMs) {
    return null; // Trial hasn't started or has expired
  }

  const elapsedDays = Math.floor(elapsedMs / oneDayMs);
  const daysRemaining = trialLengthDays - elapsedDays;

  // For 3-day legacy trial: soft banners on days 2 and 3 (elapsedDays 1 or 2)
  // For 7-day trial: show banner when 3 or fewer days remaining
  const showBanner =
    trialLengthDays === 3 ? elapsedDays === 1 || elapsedDays === 2 : daysRemaining <= 3;

  return {
    showBanner,
    daysRemaining,
  };
}
