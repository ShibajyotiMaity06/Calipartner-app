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
    outbox: [],
    goal_profiles: [],
    health_screenings: [],
  };

  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        memory = { ...memory, ...JSON.parse(saved) };
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
          const row: Record<string, unknown> = {};

          let paramIdx = 0;
          for (let i = 0; i < cols.length; i++) {
            const col = cols[i]!;
            row[col] = params[paramIdx++];
          }

          if (table === 'local_activity_days') {
            const existingIdx = list.findIndex(
              (r) => r.user_id === row.user_id && r.local_date === row.local_date,
            );
            if (existingIdx >= 0) {
              list[existingIdx] = { ...list[existingIdx], ...row };
              persist();
              return { lastInsertRowId: existingIdx + 1, changes: 1 };
            }
          }

          list.push(row);
          persist();
          return { lastInsertRowId: list.length, changes: 1 };
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
              item.stride_length_cm = stride !== null && stride !== undefined ? Number(stride) : null;
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
        filtered.sort((a, b) =>
          String(b.logged_at) > String(a.logged_at) ? 1 : -1,
        );
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

      return [];
    },
    async getFirstAsync<T>(sql: string, ...args: unknown[]): Promise<T | null> {
      const params = (Array.isArray(args[0]) ? args[0] : args) as unknown[];
      const lower = sql.toLowerCase();

      if (lower.includes('pragma user_version')) {
        return { user_version: 5 } as unknown as T;
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

