import PostHog, { type PostHogOptions } from 'posthog-react-native';

/**
 * Sensitive fields that must NEVER be sent to external analytics
 * (PRD Section 12 & CaliPartner Non-negotiables: Zero PII, no health data).
 */
const SENSITIVE_PROPERTY_KEYS = new Set([
  'calories',
  'calorie',
  'weight',
  'food_name',
  'meal_name',
  'chat_message',
  'message',
  'email',
  'password',
  'birth_date',
  'phone',
  'address',
  'latitude',
  'longitude',
]);

/**
 * Strip sensitive health metrics and personal identifiable information from properties.
 */
export function sanitizeAnalyticsProperties(
  properties?: Record<string, unknown>,
): Record<string, any> {
  if (!properties) return {};

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(properties)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_PROPERTY_KEYS.has(lowerKey)) {
      continue;
    }
    // Also block keys containing sensitive substrings
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('secret')
    ) {
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

interface AnalyticsState {
  client: PostHog | null;
  optedOut: boolean;
  initialized: boolean;
  activeScreen: string | null;
  screenEnteredAt: number;
}

const state: AnalyticsState = {
  client: null,
  optedOut: false,
  initialized: false,
  activeScreen: null,
  screenEnteredAt: Date.now(),
};

/**
 * Initialize PostHog client.
 * If API key is missing (e.g. tests or local dev without analytics key),
 * the service operates in mock/noop mode without throwing errors.
 */
export async function initAnalytics(options?: {
  apiKey?: string;
  host?: string;
  optOut?: boolean;
}): Promise<void> {
  const apiKey = options?.apiKey ?? process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
  const host = options?.host ?? process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

  state.optedOut = Boolean(options?.optOut);

  if (!apiKey) {
    // No-op / test mode
    state.initialized = true;
    state.client = null;
    return;
  }

  try {
    const postHogOptions: PostHogOptions = {
      host,
      captureAppLifecycleEvents: true,
      flushAt: 20, // Batch up to 20 events in memory before flushing
      flushInterval: 30000, // Flush every 30 seconds
    };

    const client = new PostHog(apiKey, postHogOptions);
    await client.ready();

    state.client = client;
    state.initialized = true;

    if (state.optedOut) {
      client.optOut();
    }
  } catch {
    // Fallback gracefully on initialization issues
    state.initialized = true;
    state.client = null;
  }
}

/**
 * Set user opt-out preference for analytics.
 */
export function setAnalyticsOptOut(optedOut: boolean): void {
  state.optedOut = optedOut;
  if (state.client) {
    if (optedOut) {
      state.client.optOut();
    } else {
      state.client.optIn();
    }
  }
}

export function isAnalyticsOptedOut(): boolean {
  return state.optedOut;
}

/**
 * Identify a user safely without PII.
 */
export function identifyUser(
  userId: string,
  traits?: { is_premium?: boolean; role?: string; tier?: string },
): void {
  if (state.optedOut || !state.client) return;

  const sanitized = sanitizeAnalyticsProperties(traits);
  state.client.identify(userId, sanitized);
}

/**
 * Reset identity on logout.
 */
export function resetAnalyticsUser(): void {
  if (!state.client) return;
  state.client.reset();
}

/**
 * Track an event with automatic PII/health data sanitization.
 */
export function trackEvent(eventName: string, properties?: Record<string, unknown>): void {
  if (state.optedOut) return;

  const sanitized = sanitizeAnalyticsProperties(properties);

  if (state.client) {
    state.client.capture(eventName, sanitized);
  }
}

/**
 * Track entering a screen.
 */
export function trackScreenView(screenName: string, properties?: Record<string, unknown>): void {
  if (state.optedOut) return;

  const sanitized = sanitizeAnalyticsProperties(properties);

  if (state.client) {
    state.client.screen(screenName, sanitized);
  }
}

/**
 * Track screen navigation and calculate dwell time for the previous screen.
 * Answers:
 * 1. Which screen are we losing users on? (Screen exits with short dwell times)
 * 2. Which screen do users like the most? (Screens with longest cumulative dwell times)
 */
export function recordScreenTransition(
  nextScreen: string,
  properties?: Record<string, unknown>,
): { previousScreen: string | null; dwellSeconds: number } {
  const now = Date.now();
  const previousScreen = state.activeScreen;
  const dwellSeconds = Math.max(0, Math.round((now - state.screenEnteredAt) / 1000));

  // If leaving an existing screen, track dwell time
  if (previousScreen && previousScreen !== nextScreen && dwellSeconds > 0) {
    trackEvent('screen_dwell_time', {
      screen: previousScreen,
      duration_seconds: dwellSeconds,
      exit_to: nextScreen,
    });
  }

  // Update current active screen
  state.activeScreen = nextScreen;
  state.screenEnteredAt = now;

  trackScreenView(nextScreen, properties);

  return { previousScreen, dwellSeconds };
}

/**
 * Get an A/B test Feature Flag value from PostHog.
 * Used for hypothesis-driven experimentation (Mauro's methodology).
 * Returns undefined if flag is not evaluated or client is not loaded.
 */
export function getFeatureFlag(flagKey: string): string | boolean | undefined {
  if (!state.client) return undefined;
  return state.client.getFeatureFlag(flagKey);
}

/**
 * PRD Section 12 Typed Helper: Track Paywall View
 */
export function trackPaywallViewed(params: {
  trigger: string;
  plan?: string;
  region?: string;
  daysSinceSignup?: number;
}): void {
  trackEvent('paywall_viewed', params);
}

/**
 * PRD Section 12 Typed Helper: Track First Meal Logged
 */
export function trackFirstMealLogged(params: {
  method: 'search' | 'scan' | 'photo' | 'custom' | 'history';
  secondsSinceInstall?: number;
}): void {
  trackEvent('first_meal_logged', params);
}

/**
 * PRD Section 12 Typed Helper: Track Food Logged
 */
export function trackFoodLogged(params: {
  method: 'search' | 'scan' | 'photo' | 'custom' | 'history';
  mealSection: string;
  roomShared?: boolean;
}): void {
  trackEvent('food_logged', {
    method: params.method,
    meal_section: params.mealSection,
    room_shared: Boolean(params.roomShared),
  });
}

/**
 * Internal helper for testing state inspection.
 */
export function _resetAnalyticsStateForTesting(): void {
  state.client = null;
  state.optedOut = false;
  state.initialized = false;
  state.activeScreen = null;
  state.screenEnteredAt = Date.now();
}
