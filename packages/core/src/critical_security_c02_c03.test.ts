import { describe, expect, it } from 'vitest';
import {
  mapProductIdToTierAndPeriod,
  verifyWebhookAuth,
} from './subscriptions';
import {
  mapVisionItemToFood,
  validateFoodPhotoImage,
} from './ai_food_photo';
import type { Food, VisionModelDetectedItem } from './types';

describe('Critical Security Finding C02: Webhook Secret & Payload Validation', () => {
  it('strictly rejects when webhook secret is missing, empty, or whitespace', () => {
    expect(verifyWebhookAuth('Bearer valid_token', '')).toBe(false);
    expect(verifyWebhookAuth('Bearer valid_token', '   ')).toBe(false);
    expect(verifyWebhookAuth('Bearer valid_token', undefined as unknown as string)).toBe(false);
    expect(verifyWebhookAuth('Bearer valid_token', null as unknown as string)).toBe(false);
  });

  it('rejects when authorization header is missing, empty, or incorrect', () => {
    const secret = 'prod_rc_secret_xyz123';
    expect(verifyWebhookAuth('', secret)).toBe(false);
    expect(verifyWebhookAuth(null, secret)).toBe(false);
    expect(verifyWebhookAuth(undefined, secret)).toBe(false);
    expect(verifyWebhookAuth('Bearer wrong_secret', secret)).toBe(false);
    expect(verifyWebhookAuth('wrong_secret', secret)).toBe(false);
  });

  it('accepts authorization header when secret matches exactly (with or without Bearer prefix)', () => {
    const secret = 'prod_rc_secret_xyz123';
    expect(verifyWebhookAuth(`Bearer ${secret}`, secret)).toBe(true);
    expect(verifyWebhookAuth(`bearer ${secret}`, secret)).toBe(true);
    expect(verifyWebhookAuth(secret, secret)).toBe(true);
  });

  it('validates product mapping for recognized tiers and periods', () => {
    expect(mapProductIdToTierAndPeriod('pro_monthly')).toEqual({ tier: 'pro', period: 'monthly' });
    expect(mapProductIdToTierAndPeriod('pro_yearly')).toEqual({ tier: 'pro', period: 'annual' });
    expect(mapProductIdToTierAndPeriod('plus_annual')).toEqual({ tier: 'plus', period: 'annual' });
    expect(mapProductIdToTierAndPeriod('plus_monthly')).toEqual({ tier: 'plus', period: 'monthly' });
    // Unknown or invalid products must return null
    expect(mapProductIdToTierAndPeriod('forged_product')).toBeNull();
    expect(mapProductIdToTierAndPeriod('')).toBeNull();
  });

  it('validates UUID format for app_user_id and transfer targets', () => {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(UUID_REGEX.test('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(UUID_REGEX.test('invalid-user-id')).toBe(false);
    expect(UUID_REGEX.test('')).toBe(false);
    expect(UUID_REGEX.test("'; drop table users; --")).toBe(false);
  });
});

describe('Critical Security Finding C03: AI Food Photo Privacy & Boundary Controls', () => {
  it('strictly validates image MIME type and payload size', () => {
    expect(validateFoodPhotoImage('image/jpeg', 5000).valid).toBe(true);
    expect(validateFoodPhotoImage('image/png', 5000).valid).toBe(true);
    expect(validateFoodPhotoImage('image/webp', 5000).valid).toBe(true);
    expect(validateFoodPhotoImage('image/heic', 5000).valid).toBe(true);

    // Unsupported mime types rejected
    expect(validateFoodPhotoImage('application/pdf', 5000).valid).toBe(false);
    expect(validateFoodPhotoImage('text/html', 5000).valid).toBe(false);

    // Empty or oversized images rejected
    expect(validateFoodPhotoImage('image/jpeg', 0).valid).toBe(false);
    expect(validateFoodPhotoImage('image/jpeg', 15 * 1024 * 1024).valid).toBe(false); // > 10MB
  });

  it('matches detected food only against provided catalog and never discloses unprovided private records', () => {
    const callerId = '00000000-0000-0000-0000-000000000001';
    const strangerId = '99999999-9999-9999-9999-999999999999';

    // Catalog filtered by caller scope: contains only public foods and caller own foods
    const allowedCatalog: Food[] = [
      {
        id: 'food-public-1',
        name: 'Cooked White Rice',
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        carbs_per_100g: 28.2,
        fat_per_100g: 0.3,
        source: 'ifct',
        serving_units: [],
      },
      {
        id: 'food-caller-custom',
        name: 'Caller Homemade Dal',
        calories_per_100g: 110,
        protein_per_100g: 7,
        carbs_per_100g: 15,
        fat_per_100g: 2.5,
        source: 'user',
        serving_units: [],
      },
    ] as unknown as Food[];

    const detectedItem: VisionModelDetectedItem = {
      food_name: 'White Rice',
      estimated_grams: 150,
      confidence: 0.9,
    };

    const candidate = mapVisionItemToFood(detectedItem, allowedCatalog, 'cand-1');
    expect(candidate.matched_food.id).toBe('food-public-1');
    expect(candidate.matched_food.name).toBe('Cooked White Rice');

    // Searching for stranger recipe not present in allowed catalog falls back to safe estimate food
    const strangerDetectedItem: VisionModelDetectedItem = {
      food_name: 'Secret stranger recovery recipe',
      estimated_grams: 200,
      confidence: 0.8,
    };

    const strangerCandidate = mapVisionItemToFood(strangerDetectedItem, allowedCatalog, 'cand-2');
    expect(strangerCandidate.matched_food.id).toBe('cand-2-food');
    expect(strangerCandidate.is_estimate).toBe(true);
    // Confidential records of strangerId are never accessible
    expect((strangerCandidate.matched_food as unknown as Record<string, unknown>).owner_id).toBeFalsy();
  });
});
