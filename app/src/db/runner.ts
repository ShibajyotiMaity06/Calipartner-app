import type { LocalMigration } from '@/db/migrations';

/** Minimal subset of expo-sqlite's SQLiteDatabase used by the runner (keeps it unit-testable). */
export interface MigratableDb {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
  withExclusiveTransactionAsync?(task: () => Promise<void>): Promise<void>;
}

/**
 * Applies pending migrations in order, each in a transaction, tracking progress in
 * PRAGMA user_version. Returns the final schema version. Idempotent.
 */
export async function runMigrations(
  db: MigratableDb,
  migrations: readonly LocalMigration[],
): Promise<number> {
  assertValid(migrations);
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let current = row?.user_version ?? 0;

  for (const m of migrations) {
    if (m.version <= current) continue;
    await db
      .execAsync(`BEGIN; ${m.sql}\nPRAGMA user_version = ${m.version}; COMMIT;`)
      .catch(async (e: unknown) => {
        await db.execAsync('ROLLBACK;').catch(() => undefined);
        throw e;
      });
    current = m.version;
  }
  return current;
}

function assertValid(migrations: readonly LocalMigration[]): void {
  let prev = 0;
  for (const m of migrations) {
    if (!Number.isInteger(m.version) || m.version <= prev) {
      throw new Error(`Local migrations must have strictly increasing versions (at ${m.name})`);
    }
    prev = m.version;
  }
}
