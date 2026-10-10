import { type Food } from '@calipartner/core';
import { createLogger } from '@/lib/logger';
import { getDb } from '@/db';
import { getSupabase } from '@/lib/supabase';
import { findLocalFoodByBarcode, lookupRemoteFood } from './foodService';
import type { SyncDb } from './syncService';

const log = createLogger('barcodeScanService');

export interface BarcodeLookupResult {
  food: Food | null;
  source: 'local' | 'remote' | 'not_found';
}

/**
 * Searches for a food by its barcode.
 * Priority:
 * 1. Local SQLite cache / bundled foods
 * 2. Remote Edge Function `food-lookup` (Open Food Facts & USDA)
 * If found remotely, caches into local_foods SQLite table.
 */
export async function lookupBarcode(
  barcode: string,
  customDb?: SyncDb,
  isOnline = true,
): Promise<BarcodeLookupResult> {
  const clean = barcode.trim();
  if (!clean) {
    return { food: null, source: 'not_found' };
  }

  const db = customDb ?? (await getDb());

  // 1. Check local SQLite first
  const localMatch = await findLocalFoodByBarcode(db, clean);
  if (localMatch) {
    log.info(`Found barcode ${clean} in local cache`);
    return { food: localMatch, source: 'local' };
  }

  // 2. If online, check remote Edge Function
  if (isOnline) {
    try {
      const supabase = getSupabase();
      const remoteFood = await lookupRemoteFood(supabase, { barcode: clean });

      if (remoteFood) {
        log.info(`Found barcode ${clean} from remote lookup; caching locally`);
        // Cache remotely fetched food locally in local_foods
        const now = new Date().toISOString();
        const unitsJson = JSON.stringify(remoteFood.serving_units ?? [{ unit: 'g', grams: 1 }]);

        await db.runAsync(
          `INSERT INTO local_foods (
            id, source, name, brand, barcode, serving_units,
            calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
            fiber_per_100g, sugar_per_100g, sodium_mg_per_100g,
            owner_id, attribution, created_at, updated_at, deleted_at, sync_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, 'synced')
          ON CONFLICT (id) DO UPDATE SET
            name = excluded.name,
            brand = excluded.brand,
            barcode = excluded.barcode,
            serving_units = excluded.serving_units,
            calories_per_100g = excluded.calories_per_100g,
            protein_per_100g = excluded.protein_per_100g,
            carbs_per_100g = excluded.carbs_per_100g,
            fat_per_100g = excluded.fat_per_100g,
            fiber_per_100g = excluded.fiber_per_100g,
            sugar_per_100g = excluded.sugar_per_100g,
            sodium_mg_per_100g = excluded.sodium_mg_per_100g,
            attribution = excluded.attribution,
            updated_at = excluded.updated_at`,
          [
            remoteFood.id,
            remoteFood.source,
            remoteFood.name,
            remoteFood.brand ?? null,
            remoteFood.barcode ?? clean,
            unitsJson,
            remoteFood.calories_per_100g,
            remoteFood.protein_per_100g,
            remoteFood.carbs_per_100g,
            remoteFood.fat_per_100g,
            remoteFood.fiber_per_100g ?? 0,
            remoteFood.sugar_per_100g ?? 0,
            remoteFood.sodium_mg_per_100g ?? 0,
            remoteFood.attribution ?? 'Open Food Facts',
            now,
            now,
          ],
        );

        return { food: remoteFood, source: 'remote' };
      }
    } catch (e) {
      log.warn(`Remote barcode lookup error: ${e}`);
    }
  }

  return { food: null, source: 'not_found' };
}
