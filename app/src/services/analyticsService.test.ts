import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initAnalytics,
  sanitizeAnalyticsProperties,
  setAnalyticsOptOut,
  isAnalyticsOptedOut,
  trackEvent,
  trackScreenView,
  recordScreenTransition,
  trackPaywallViewed,
  trackFirstMealLogged,
  trackFoodLogged,
  _resetAnalyticsStateForTesting,
} from './analyticsService';

describe('analyticsService', () => {
  beforeEach(() => {
    _resetAnalyticsStateForTesting();
    vi.clearAllMocks();
  });

  describe('sanitizeAnalyticsProperties', () => {
    it('strips all sensitive health and PII metrics', () => {
      const raw = {
        calories: 2150,
        calorie: 500,
        weight: 78.5,
        food_name: 'Paneer Butter Masala',
        chat_message: 'Hey partner!',
        message: 'secret private text',
        email: 'user@example.com',
        password: 'password123',
        auth_token: 'xyz-token',
        // Safe properties:
        method: 'barcode',
        meal_section: 'lunch',
        tier: 'pro',
        screen: '/today',
      };

      const clean = sanitizeAnalyticsProperties(raw);

      // Verify sensitive fields are removed
      expect(clean.calories).toBeUndefined();
      expect(clean.calorie).toBeUndefined();
      expect(clean.weight).toBeUndefined();
      expect(clean.food_name).toBeUndefined();
      expect(clean.chat_message).toBeUndefined();
      expect(clean.message).toBeUndefined();
      expect(clean.email).toBeUndefined();
      expect(clean.password).toBeUndefined();
      expect(clean.auth_token).toBeUndefined();

      // Verify safe properties are retained
      expect(clean.method).toBe('barcode');
      expect(clean.meal_section).toBe('lunch');
      expect(clean.tier).toBe('pro');
      expect(clean.screen).toBe('/today');
    });

    it('returns empty object when properties are undefined', () => {
      expect(sanitizeAnalyticsProperties(undefined)).toEqual({});
    });
  });

  describe('no-op mode (no API key configured)', () => {
    it('initializes gracefully without throwing when key is missing', async () => {
      await expect(initAnalytics({ apiKey: '' })).resolves.toBeUndefined();
    });

    it('allows trackEvent and trackScreenView to execute safely without client', () => {
      expect(() => {
        trackEvent('test_event', { step: 1 });
        trackScreenView('/onboarding/goal');
      }).not.toThrow();
    });
  });

  describe('opt-out handling', () => {
    it('honors opt-out switch', () => {
      expect(isAnalyticsOptedOut()).toBe(false);

      setAnalyticsOptOut(true);
      expect(isAnalyticsOptedOut()).toBe(true);

      setAnalyticsOptOut(false);
      expect(isAnalyticsOptedOut()).toBe(false);
    });
  });

  describe('recordScreenTransition (dwell time & drop-off tracking)', () => {
    it('records transitions and computes dwell time correctly', () => {
      // Step 1: User enters onboarding goal screen
      const transition1 = recordScreenTransition('/onboarding/goal');
      expect(transition1.previousScreen).toBeNull();

      // Step 2: User navigates to profile screen after some time
      const transition2 = recordScreenTransition('/onboarding/profile');
      expect(transition2.previousScreen).toBe('/onboarding/goal');
      expect(transition2.dwellSeconds).toBeGreaterThanOrEqual(0);

      // Step 3: User navigates to dashboard
      const transition3 = recordScreenTransition('/today');
      expect(transition3.previousScreen).toBe('/onboarding/profile');
    });
  });

  describe('PRD Section 12 typed helpers', () => {
    it('tracks paywall viewed without throwing', () => {
      expect(() => {
        trackPaywallViewed({
          trigger: 'coach_limit_hit',
          plan: 'pro_monthly',
          region: 'IN',
        });
      }).not.toThrow();
    });

    it('tracks first meal logged without throwing', () => {
      expect(() => {
        trackFirstMealLogged({
          method: 'scan',
          secondsSinceInstall: 120,
        });
      }).not.toThrow();
    });

    it('tracks food logged with sanitized parameters', () => {
      expect(() => {
        trackFoodLogged({
          method: 'search',
          mealSection: 'breakfast',
          roomShared: true,
        });
      }).not.toThrow();
    });
  });
});
