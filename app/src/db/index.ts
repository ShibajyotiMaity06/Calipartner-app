import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { migrations } from '@/db/migrations';
import { runMigrations } from '@/db/runner';
import { createLogger } from '@/lib/logger';

const log = createLogger('db');
const DB_NAME = 'calipartner.db';

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

/** Opens the local database once, enables WAL, and applies pending migrations. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!opening) {
    opening = (async () => {
      if (Platform.OS === 'web') {
        log.info('Running on web; using reactive web database');
        return createWebDb();
      }

      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL;');
      const version = await runMigrations(db, migrations);
      log.info(`local database ready (schema v${version})`);
      return db;
    })().catch((e: unknown) => {
      opening = null; // allow retry
      throw e;
    });
  }
  return opening;
}

function createWebDb(): SQLite.SQLiteDatabase {
  const STORAGE_KEY = 'calipartner_web_db';
  let memory: Record<string, Record<string, unknown>[]> = {
    local_water_logs: [],
    local_weight_logs: [],
    local_activity_days: [],
    local_foods: [],
    local_food_entries: [],
    local_recipes: [],
    local_recipe_ingredients: [],
    local_recipe_favorites: [],
    local_recipe_recently_viewed: [],
    local_recipe_reports: [],
    outbox: [],
    local_goal_profiles: [],
    local_health_screening: [],
    goal_profiles: [],
    health_screenings: [],
  };

  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        memory = { ...memory, ...JSON.parse(saved) };
        if (memory.goal_profiles?.length && !memory.local_goal_profiles?.length) {
          memory.local_goal_profiles = [...memory.goal_profiles];
        }
      }
    }
  } catch {
    // fallback to in-memory
  }

  const persist = () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
      }
    } catch {
      // ignore
    }
  };

  return {
    async execAsync() {
      // no-op for CREATE TABLE / PRAGMA in web mock
    },
    async withTransactionAsync<T>(action: () => Promise<T>): Promise<T> {
      return action();
    },
    async runAsync(sql: string, ...args: unknown[]) {
      const params = (Array.isArray(args[0]) ? args[0] : args) as unknown[];
      const lower = sql.toLowerCase().trim();

      if (lower.startsWith('insert into')) {
        const match = sql.match(/insert\s+into\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)/i);
        if (match) {
          const table = match[1]!;
          const cols = match[2]!.split(',').map((c) => c.trim());
          const list = memory[table] || (memory[table] = []);

          const colCount = cols.length;
          const rowCount = Math.max(1, Math.floor(params.length / colCount));

          for (let r = 0; r * colCount < params.length; r++) {
            const row: Record<string, unknown> = {};
            for (let c = 0; c < colCount; c++) {
              row[cols[c]!] = params[r * colCount + c];
            }
            if (table === 'local_activity_days') {
              const existingIdx = list.findIndex(
                (ex) => ex.user_id === row.user_id && ex.local_date === row.local_date,
              );
              if (existingIdx >= 0) {
                list[existingIdx] = { ...list[existingIdx], ...row };
                continue;
              }
            }
            if (table === 'local_goal_profiles') {
              const existingIdx = list.findIndex(
                (ex) => ex.id === row.id || (ex.user_id === row.user_id && row.user_id),
              );
              if (existingIdx >= 0) {
                list[existingIdx] = { ...list[existingIdx], ...row };
                continue;
              }
            }
            if (table === 'local_health_screening') {
              const existingIdx = list.findIndex((ex) => ex.user_id === row.user_id);
              if (existingIdx >= 0) {
                list[existingIdx] = { ...list[existingIdx], ...row };
                continue;
              }
            }
            list.push(row);
          }
          persist();
          return { lastInsertRowId: list.length, changes: rowCount };
        }
      }

      if (lower.startsWith('update')) {
        const match = sql.match(/update\s+([a-zA-Z0-9_]+)\s+set\s+(.+?)\s+where\s+(.+)$/i);
        if (match) {
          const table = match[1]!;
          const list = memory[table] || [];
          let changes = 0;

          if (table === 'local_water_logs') {
            if (lower.includes('deleted_at = ?')) {
              const [deletedAt, updatedAt, id, userId] = params;
              const item = list.find((r) => r.id === id && r.user_id === userId);
              if (item) {
                item.deleted_at = deletedAt;
                item.updated_at = updatedAt;
                changes++;
              }
            } else if (lower.includes('amount_ml = ?')) {
              const [amountMl, updatedAt, id, userId] = params;
              const item = list.find((r) => r.id === id && r.user_id === userId);
              if (item) {
                item.amount_ml = Number(amountMl);
                item.updated_at = updatedAt;
                changes++;
              }
            }
          }

          if (table === 'local_weight_logs') {
            if (lower.includes('deleted_at = ?')) {
              const [deletedAt, updatedAt, id, userId] = params;
              const item = list.find((r) => r.id === id && r.user_id === userId);
              if (item) {
                item.deleted_at = deletedAt;
                item.updated_at = updatedAt;
                changes++;
              }
            } else if (lower.includes('weight_kg = ?')) {
              const [weightKg, notes, updatedAt, id, userId] = params;
              const item = list.find((r) => r.id === id && r.user_id === userId);
              if (item) {
                item.weight_kg = Number(weightKg);
                item.notes = notes;
                item.updated_at = updatedAt;
                changes++;
              }
            }
          }

          if (table === 'local_activity_days') {
            const [steps, dist, src, stride, updatedAt, userId, localDate] = params;
            const item = list.find((r) => r.user_id === userId && r.local_date === localDate);
            if (item) {
              item.steps = Number(steps);
              item.distance_m = dist !== null && dist !== undefined ? Number(dist) : null;
              item.source = src;
              item.stride_length_cm =
                stride !== null && stride !== undefined ? Number(stride) : null;
              item.updated_at = updatedAt;
              changes++;
            }
          }

          persist();
          return { lastInsertRowId: 1, changes };
        }
      }

      return { lastInsertRowId: 1, changes: 1 };
    },
    async getAllAsync<T>(sql: string, ...args: unknown[]): Promise<T[]> {
      const params = (Array.isArray(args[0]) ? args[0] : args) as unknown[];
      const lower = sql.toLowerCase();

      if (lower.includes('from local_water_logs')) {
        const [userId, localDate] = params as [string, string];
        const list = memory.local_water_logs || [];
        const filtered = list.filter(
          (r) => r.user_id === userId && r.local_date === localDate && !r.deleted_at,
        );
        filtered.sort((a, b) => (String(b.logged_at) > String(a.logged_at) ? 1 : -1));
        return filtered as unknown as T[];
      }

      if (lower.includes('from local_weight_logs')) {
        const [userId] = params as [string];
        const list = memory.local_weight_logs || [];
        const filtered = list.filter((r) => r.user_id === userId && !r.deleted_at);
        filtered.sort((a, b) =>
          b.local_date !== a.local_date
            ? String(b.local_date) > String(a.local_date)
              ? 1
              : -1
            : String(b.logged_at) > String(a.logged_at)
              ? 1
              : -1,
        );
        return filtered as unknown as T[];
      }

      if (lower.includes('from local_activity_days')) {
        const [userId, localDate] = params as [string, string];
        const list = memory.local_activity_days || [];
        const filtered = list.filter((r) => r.user_id === userId && r.local_date === localDate);
        return filtered as unknown as T[];
      }

      if (lower.includes('from local_foods')) {
        let list = memory.local_foods || [];
        if (list.length === 0) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const bundled = require('../../assets/bundled_foods.json');
            list = memory.local_foods = (bundled as Array<Record<string, unknown>>).map((b) => ({
              ...b,
              serving_units: JSON.stringify(b.serving_units || [{ unit: 'g', grams: 1 }]),
              deleted_at: null,
            }));
            persist();
          } catch {}
        }

        if (lower.includes('like ?') && params.length >= 1) {
          const rawPat = String(params[0] || '')
            .replace(/%/g, '')
            .toLowerCase()
            .trim();
          const userId = params[2] ? String(params[2]) : '';
          const limit = Number(params[params.length - 1]) || 40;

          const matches = list.filter((r) => {
            if (r.deleted_at) return false;
            if (r.owner_id && r.owner_id !== userId) return false;
            const name = String(r.name || '').toLowerCase();
            const brand = String(r.brand || '').toLowerCase();
            return name.includes(rawPat) || brand.includes(rawPat);
          });

          matches.sort((a, b) => {
            const aName = String(a.name || '').toLowerCase();
            const bName = String(b.name || '').toLowerCase();
            if (aName === rawPat && bName !== rawPat) return -1;
            if (bName === rawPat && aName !== rawPat) return 1;
            if (aName.startsWith(rawPat) && !bName.startsWith(rawPat)) return -1;
            if (bName.startsWith(rawPat) && !aName.startsWith(rawPat)) return 1;
            return aName.localeCompare(bName);
          });

          return matches.slice(0, limit) as unknown as T[];
        }

        return list as unknown as T[];
      }

      if (lower.includes('from local_recipes')) {
        let list = memory.local_recipes || [];
        if (list.length === 0) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const bundled = require('../../assets/bundled_recipes.json');
            const arr = (bundled.recipes || (Array.isArray(bundled) ? bundled : [])) as Array<
              Record<string, unknown>
            >;
            list = memory.local_recipes = arr.map((r) => ({
              ...r,
              diet_tags: Array.isArray(r.diet_tags)
                ? JSON.stringify(r.diet_tags)
                : String(r.diet_tags || '[]'),
              steps: Array.isArray(r.steps) ? JSON.stringify(r.steps) : String(r.steps || '[]'),
              tips: Array.isArray(r.tips) ? JSON.stringify(r.tips) : String(r.tips || '[]'),
              image_urls: Array.isArray(r.image_urls)
                ? JSON.stringify(r.image_urls)
                : String(r.image_urls || '[]'),
              nutrition_per_serving:
                typeof r.nutrition_per_serving === 'object'
                  ? JSON.stringify(r.nutrition_per_serving)
                  : String(r.nutrition_per_serving || '{}'),
            }));
            persist();
          } catch {}
        }
        return list as unknown as T[];
      }

      if (lower.includes('from local_goal_profiles')) {
        const list = memory.local_goal_profiles || memory.goal_profiles || [];
        return list as unknown as T[];
      }

      if (lower.includes('from local_food_entries')) {
        const list = memory.local_food_entries || [];
        let filtered = list.filter((r) => !r.deleted_at);
        if (params.length >= 2) {
          const [userId, localDate] = params as [string, string];
          filtered = filtered.filter((r) => r.user_id === userId && r.local_date === localDate);
        }
        return filtered as unknown as T[];
      }

      return [];
    },
    async getFirstAsync<T>(sql: string, ...args: unknown[]): Promise<T | null> {
      const params = (Array.isArray(args[0]) ? args[0] : args) as unknown[];
      const lower = sql.toLowerCase();

      if (lower.includes('pragma user_version')) {
        return { user_version: 5 } as unknown as T;
      }

      if (lower.includes('from local_goal_profiles')) {
        const list = memory.local_goal_profiles || memory.goal_profiles || [];
        if (list.length > 0) {
          const sorted = [...list].sort((a, b) => {
            const timeA = String(a.effective_from || a.created_at || '');
            const timeB = String(b.effective_from || b.created_at || '');
            return timeB.localeCompare(timeA);
          });
          if (params.length > 0 && params[0]) {
            const userId = String(params[0]);
            const match = sorted.find((p) => p.user_id === userId);
            if (match) return match as unknown as T;
          }
          return sorted[0] as unknown as T;
        }
        return null;
      }

      if (lower.includes('from local_health_screening')) {
        const list = memory.local_health_screening || memory.health_screenings || [];
        if (list.length > 0) {
          const sorted = [...list].sort((a, b) => {
            const timeA = String(a.updated_at || a.created_at || '');
            const timeB = String(b.updated_at || b.created_at || '');
            return timeB.localeCompare(timeA);
          });
          if (params.length > 0 && params[0]) {
            const userId = String(params[0]);
            const match = sorted.find((s) => s.user_id === userId);
            if (match) return match as unknown as T;
          }
          return sorted[0] as unknown as T;
        }
        return null;
      }

      if (lower.includes('from local_foods') && lower.includes('count(*) as count')) {
        let count = (memory.local_foods || []).length;
        if (count === 0) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const bundled = require('../../assets/bundled_foods.json');
            count = bundled.length;
          } catch {}
        }
        return { count } as unknown as T;
      }

      if (lower.includes('from local_foods') && lower.includes('barcode = ?')) {
        const [barcode] = params as [string];
        const list = memory.local_foods || [];
        const found = list.find((r) => r.barcode === barcode && !r.deleted_at);
        return (found as unknown as T) || null;
      }

      if (lower.includes('from local_recipes') && lower.includes('id = ?')) {
        const [id] = params as [string];
        const list = memory.local_recipes || [];
        const found = list.find((r) => r.id === id);
        return (found as unknown as T) || null;
      }

      if (lower.includes('sum(amount_ml)')) {
        const [userId, localDate] = params as [string, string];
        const list = memory.local_water_logs || [];
        const sum = list
          .filter((r) => r.user_id === userId && r.local_date === localDate && !r.deleted_at)
          .reduce((acc, r) => acc + (Number(r.amount_ml) || 0), 0);
        return { total: sum } as unknown as T;
      }

      if (lower.includes('from local_water_logs')) {
        const [userId, localDate] = params as [string, string];
        const list = memory.local_water_logs || [];
        const found = list
          .filter((r) => r.user_id === userId && r.local_date === localDate && !r.deleted_at)
          .sort((a, b) => (String(b.logged_at) > String(a.logged_at) ? 1 : -1))[0];
        return (found as unknown as T) || null;
      }

      if (lower.includes('from local_activity_days')) {
        const [userId, localDate] = params as [string, string];
        const list = memory.local_activity_days || [];
        const found = list.find((r) => r.user_id === userId && r.local_date === localDate);
        return (found as unknown as T) || null;
      }

      if (lower.includes('from local_weight_logs')) {
        const [userId, localDate] = params as [string, string];
        const list = memory.local_weight_logs || [];
        const found = list.find(
          (r) => r.user_id === userId && r.local_date === localDate && !r.deleted_at,
        );
        return (found as unknown as T) || null;
      }

      return null;
    },
  } as unknown as SQLite.SQLiteDatabase;
}

/**
 * Wipes all on-device SQLite tables on account deletion (H21 fix).
 */
export async function clearAllLocalData(): Promise<void> {
  const db = await getDb();
  const tables = [
    'outbox',
    'guest_entries',
    'local_goal_profiles',
    'local_health_screening',
    'local_foods',
    'local_food_entries',
    'local_water_logs',
    'local_weight_logs',
    'local_activity_days',
    'local_chat_messages',
    'local_chat_attachments',
    'local_chat_read_state',
    'local_chat_room_settings',
    'local_focus_sessions',
    'local_recipes',
    'local_recipe_ingredients',
    'local_recipe_favorites',
    'local_recipe_recently_viewed',
    'local_fasting_sessions',
  ];

  for (const table of tables) {
    try {
      await db.runAsync(`DELETE FROM ${table};`);
    } catch {
      // Table may not exist or already be empty, continue
    }
  }
}
