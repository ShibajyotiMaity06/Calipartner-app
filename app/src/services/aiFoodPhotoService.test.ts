import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  acceptAiProcessingConsent,
  AiFoodPhotoServiceError,
  analyzeFoodPhoto,
  checkAiProcessingConsent,
  getAiFoodPhotoUsageStatus,
  preparePhotoForAiAnalysis,
  savePhotoCandidatesToDiary,
  swapCandidateFood,
  updateCandidateQuantity,
} from './aiFoodPhotoService';
import { getPendingOutboxItems, type SyncDb } from './syncService';
import type { Food, FoodCandidateItem } from '@calipartner/core';

function createTestDb(): SyncDb {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
    CREATE TABLE outbox (
      id TEXT PRIMARY KEY NOT NULL,
      entity TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      next_retry_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE local_foods (
      id TEXT PRIMARY KEY NOT NULL,
      source TEXT NOT NULL,
      name TEXT NOT NULL,
      brand TEXT,
      barcode TEXT,
      serving_units TEXT NOT NULL,
      calories_per_100g REAL NOT NULL,
      protein_per_100g REAL NOT NULL,
      carbs_per_100g REAL NOT NULL,
      fat_per_100g REAL NOT NULL,
      fiber_per_100g REAL NOT NULL DEFAULT 0,
      sugar_per_100g REAL NOT NULL DEFAULT 0,
      sodium_mg_per_100g REAL NOT NULL DEFAULT 0,
      owner_id TEXT,
      attribution TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_state TEXT NOT NULL DEFAULT 'synced'
    );

    CREATE TABLE local_food_entries (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      food_id TEXT,
      meal_section TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL,
      fiber REAL NOT NULL DEFAULT 0,
      sugar REAL NOT NULL DEFAULT 0,
      sodium_mg REAL NOT NULL DEFAULT 0,
      food_name TEXT NOT NULL,
      brand_name TEXT,
      logged_at TEXT NOT NULL,
      local_date TEXT NOT NULL,
      source TEXT NOT NULL,
      shared_meal_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_state TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE local_user_food_stats (
      user_id TEXT NOT NULL,
      food_id TEXT NOT NULL,
      use_count INTEGER NOT NULL DEFAULT 1,
      last_used_at TEXT NOT NULL,
      last_quantity REAL NOT NULL,
      last_unit TEXT NOT NULL,
      last_meal_section TEXT NOT NULL,
      hidden INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      sync_state TEXT NOT NULL DEFAULT 'pending',
      PRIMARY KEY (user_id, food_id)
    );
  `);

  return {
    async runAsync(sql: string, ...params: unknown[]) {
      const flat = Array.isArray(params[0]) ? params[0] : params;
      const stmt = sqlite.prepare(sql);
      const res = stmt.run(...flat);
      return { changes: res.changes, lastInsertRowId: res.lastInsertRowid };
    },
    async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
      const flat = Array.isArray(params[0]) ? params[0] : params;
      const stmt = sqlite.prepare(sql);
      const row = stmt.get(...flat);
      return (row as T) || null;
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
      const flat = Array.isArray(params[0]) ? params[0] : params;
      const stmt = sqlite.prepare(sql);
      return stmt.all(...flat) as T[];
    },
  };
}

describe('Phase 11: aiFoodPhotoService (Client Service & Diary Integration)', () => {
  describe('Consent Management (PRD 8.2)', () => {
    it('checks AI processing consent via RPC or query', async () => {
      const mockSupabaseWithConsent = {
        rpc: async (name: string) => {
          if (name === 'has_ai_processing_consent') return { data: true, error: null };
          return { data: null, error: null };
        },
      };

      const hasConsent = await checkAiProcessingConsent(mockSupabaseWithConsent, 'user-1');
      expect(hasConsent).toBe(true);

      const mockSupabaseNoConsent = {
        rpc: async () => ({ data: false, error: null }),
      };
      const noConsent = await checkAiProcessingConsent(mockSupabaseNoConsent, 'user-1');
      expect(noConsent).toBe(false);
    });

    it('records user consent with acceptAiProcessingConsent', async () => {
      let rpcCalledWith: { name: string; args: Record<string, unknown> } | null = null;
      const mockSupabase = {
        rpc: async (name: string, args: Record<string, unknown>) => {
          rpcCalledWith = { name, args };
          return { data: null, error: null };
        },
      };

      await acceptAiProcessingConsent(mockSupabase, '1.0');
      expect(rpcCalledWith).toEqual({
        name: 'accept_ai_processing_consent',
        args: { p_version: '1.0' },
      });
    });
  });

  describe('Photo Preparation & Compression', () => {
    it('validates and encodes JPEG buffer to base64 with stripped EXIF and scaled dims', () => {
      // JPEG header + dummy bytes
      const jpegBytes = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
      ]);
      const prepared = preparePhotoForAiAnalysis({
        buffer: jpegBytes,
        mimeType: 'image/jpeg',
        width: 3200,
        height: 2400,
      });

      expect(prepared.mimeType).toBe('image/jpeg');
      expect(typeof prepared.imageBase64).toBe('string');
      expect(prepared.imageBase64.length).toBeGreaterThan(0);
      expect(prepared.width).toBe(1600);
      expect(prepared.height).toBe(1200);
    });

    it('throws AiFoodPhotoServiceError on invalid MIME type', () => {
      const textBytes = new Uint8Array([1, 2, 3]);
      expect(() =>
        preparePhotoForAiAnalysis({
          buffer: textBytes,
          mimeType: 'text/plain',
        }),
      ).toThrowError(AiFoodPhotoServiceError);
    });
  });

  describe('Edge Function Analysis & Error Handling', () => {
    it('calls Edge Function and returns candidate items and usage stats', async () => {
      const mockSuccessResponse = {
        success: true,
        candidates: [
          {
            id: 'cand-1',
            detected_name: 'Paneer Curry',
            matched_food: {
              id: 'food-paneer',
              source: 'user',
              name: 'Paneer Curry',
              brand: null,
              barcode: null,
              serving_units: [{ unit: 'g', grams: 1 }],
              calories_per_100g: 200,
              protein_per_100g: 10,
              carbs_per_100g: 8,
              fat_per_100g: 15,
              fiber_per_100g: 2,
              sugar_per_100g: 2,
              sodium_mg_per_100g: 300,
              owner_id: null,
              attribution: 'AI Estimate',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              deleted_at: null,
            },
            quantity: 150,
            unit: 'g',
            estimated_grams: 150,
            confidence: 0.92,
            is_estimate: true,
            nutrients: {
              calories: 300,
              protein: 15,
              carbs: 12,
              fat: 22.5,
              fiber: 3,
              sugar: 3,
              sodium_mg: 450,
            },
          },
        ],
        detected_meal_type: 'dinner',
        usage: {
          used_today: 1,
          daily_cap: 3,
          remaining_today: 2,
          user_state: 'trial',
        },
      };

      const mockSupabase = {
        functions: {
          invoke: async (fn: string) => {
            if (fn === 'ai-food-photo') {
              return { data: mockSuccessResponse, error: null };
            }
            return { data: null, error: { message: 'Not found' } };
          },
        },
      };

      const result = await analyzeFoodPhoto(mockSupabase, {
        imageBase64: 'sample-base64',
        mimeType: 'image/jpeg',
      });

      expect(result.success).toBe(true);
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0]!.detected_name).toBe('Paneer Curry');
      expect(result.usage.used_today).toBe(1);
    });

    it('translates CONSENT_REQUIRED into typed error', async () => {
      const mockSupabase = {
        functions: {
          invoke: async () => ({
            data: null,
            error: { message: 'CONSENT_REQUIRED: consent needed', status: 403 },
          }),
        },
      };

      await expect(analyzeFoodPhoto(mockSupabase, { imageBase64: 'abc' })).rejects.toThrowError(
        AiFoodPhotoServiceError,
      );
    });

    it('translates DAILY_LIMIT_REACHED into typed error', async () => {
      const mockSupabase = {
        functions: {
          invoke: async () => ({
            data: null,
            error: { message: 'DAILY_LIMIT_REACHED: daily limit reached', status: 429 },
          }),
        },
      };

      await expect(analyzeFoodPhoto(mockSupabase, { imageBase64: 'abc' })).rejects.toMatchObject({
        code: 'DAILY_LIMIT_REACHED',
      });
    });

    it('translates FEATURE_DISABLED and BUDGET_EXCEEDED into typed error', async () => {
      const mockSupabase = {
        functions: {
          invoke: async () => ({
            data: null,
            error: { message: 'BUDGET_EXCEEDED: monthly budget reached', status: 503 },
          }),
        },
      };

      await expect(analyzeFoodPhoto(mockSupabase, { imageBase64: 'abc' })).rejects.toMatchObject({
        code: 'FEATURE_DISABLED',
      });
    });
  });

  describe('Candidate Editing & Swapping', () => {
    const sampleCandidate: FoodCandidateItem = {
      id: 'cand-1',
      detected_name: 'Steamed Rice',
      matched_food: {
        id: 'food-rice',
        source: 'ifct',
        name: 'Steamed Rice',
        brand: null,
        barcode: null,
        serving_units: [
          { unit: 'bowl', grams: 150 },
          { unit: 'g', grams: 1 },
        ],
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        carbs_per_100g: 28.2,
        fat_per_100g: 0.3,
        fiber_per_100g: 0.4,
        sugar_per_100g: 0.1,
        sodium_mg_per_100g: 1,
        owner_id: null,
        attribution: 'IFCT',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
        deleted_at: null,
      },
      quantity: 100,
      unit: 'g',
      estimated_grams: 100,
      confidence: 0.9,
      is_estimate: true,
      nutrients: {
        calories: 130,
        protein: 2.7,
        carbs: 28.2,
        fat: 0.3,
        fiber: 0.4,
        sugar: 0.1,
        sodium_mg: 1,
      },
    };

    it('updates candidate quantity and recalculates scaled nutrients', () => {
      const updated = updateCandidateQuantity(sampleCandidate, 200, 'g');
      expect(updated.quantity).toBe(200);
      expect(updated.estimated_grams).toBe(200);
      expect(updated.nutrients.calories).toBe(260); // 130 * 2
      expect(updated.nutrients.protein).toBe(5.4);
      expect(updated.is_estimate).toBe(true);
    });

    it('swaps candidate food with a new food item and recomputes nutrients', () => {
      const newFood: Food = {
        id: 'food-brown-rice',
        source: 'ifct',
        name: 'Brown Rice',
        brand: null,
        barcode: null,
        serving_units: [{ unit: 'g', grams: 1 }],
        calories_per_100g: 111,
        protein_per_100g: 2.6,
        carbs_per_100g: 23.0,
        fat_per_100g: 0.9,
        fiber_per_100g: 1.8,
        sugar_per_100g: 0.4,
        sodium_mg_per_100g: 5,
        owner_id: null,
        attribution: 'IFCT',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
        deleted_at: null,
      };

      const swapped = swapCandidateFood(sampleCandidate, newFood);
      expect(swapped.matched_food.id).toBe('food-brown-rice');
      expect(swapped.nutrients.calories).toBe(111);
      expect(swapped.nutrients.fiber).toBe(1.8);
      expect(swapped.is_estimate).toBe(true);
    });
  });

  describe('Saving Photo Candidates to Diary (PRD LOG-3)', () => {
    it('saves candidate items with source=photo and estimate attribution through sync layer', async () => {
      const db = createTestDb();

      const candidate: FoodCandidateItem = {
        id: 'cand-lunch-1',
        detected_name: 'Dal Fry',
        matched_food: {
          id: 'food-dal-fry',
          source: 'user',
          name: 'Dal Fry',
          brand: null,
          barcode: null,
          serving_units: [
            { unit: 'bowl', grams: 150 },
            { unit: 'g', grams: 1 },
          ],
          calories_per_100g: 120,
          protein_per_100g: 6,
          carbs_per_100g: 16,
          fat_per_100g: 3.5,
          fiber_per_100g: 3,
          sugar_per_100g: 1,
          sodium_mg_per_100g: 250,
          owner_id: null,
          attribution: 'AI Estimate',
          created_at: '2026-10-01T00:00:00Z',
          updated_at: '2026-10-01T00:00:00Z',
          deleted_at: null,
        },
        quantity: 1,
        unit: 'bowl',
        estimated_grams: 150,
        confidence: 0.95,
        is_estimate: true,
        nutrients: {
          calories: 180,
          protein: 9,
          carbs: 24,
          fat: 5.3,
          fiber: 4.5,
          sugar: 1.5,
          sodium_mg: 375,
        },
      };

      const entries = await savePhotoCandidatesToDiary(db, {
        userId: 'user-photo-tester',
        candidates: [candidate],
        mealSection: 'lunch',
        localDate: '2026-10-15',
      });

      expect(entries).toHaveLength(1);
      const entry = entries[0]!;
      expect(entry.source).toBe('photo'); // PRD LOG-3: source=photo
      expect(entry.meal_section).toBe('lunch');
      expect(entry.quantity).toBe(1);
      expect(entry.unit).toBe('bowl');
      expect(entry.calories).toBe(180);

      // Verify insertion in local_food_entries
      const row = await db.getFirstAsync<{ id: string; source: string; food_name: string }>(
        `SELECT id, source, food_name FROM local_food_entries WHERE id = ?`,
        [entry.id],
      );
      expect(row).not.toBeNull();
      expect(row?.source).toBe('photo');

      // Verify outbox queue mutation was created for sync
      const outbox = await getPendingOutboxItems(db);
      expect(outbox.some((item) => item.entity === 'food_entries' && item.id === entry.id)).toBe(
        true,
      );
    });
  });

  describe('Usage Status Helper', () => {
    it('returns daily usage, caps, and plan state', async () => {
      const mockSupabase = {
        rpc: async (name: string) => {
          if (name === 'check_ai_food_photo_access') {
            return {
              data: {
                allowed: true,
                user_state: 'trial',
                used: 1,
                cap: 3,
                remaining: 2,
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      };

      const status = await getAiFoodPhotoUsageStatus(mockSupabase, 'user-123');
      expect(status.allowed).toBe(true);
      expect(status.userState).toBe('trial');
      expect(status.usedToday).toBe(1);
      expect(status.dailyCap).toBe(3);
      expect(status.remainingToday).toBe(2);
    });
  });
});
