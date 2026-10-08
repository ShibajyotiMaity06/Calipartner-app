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
        log.info('Running on web; using in-memory mock for UI preview');
        const mockDb = {
          async execAsync() {},
          async runAsync() {
            return { lastInsertRowId: 1, changes: 1 };
          },
          async getAllAsync() {
            return [];
          },
          async getFirstAsync() {
            return null;
          },
          async withTransactionAsync<T>(action: () => Promise<T>) {
            return action();
          },
        } as unknown as SQLite.SQLiteDatabase;
        return mockDb;
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
