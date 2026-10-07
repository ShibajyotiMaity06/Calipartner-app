import { describe, expect, it } from 'vitest';
import { migrations } from './migrations';
import { runMigrations, type MigratableDb } from './runner';

function fakeDb(startVersion = 0) {
  const state = { version: startVersion, executed: [] as string[], failOn: '' };
  const db: MigratableDb = {
    async getFirstAsync<T>() {
      return { user_version: state.version } as T;
    },
    async execAsync(sql: string) {
      state.executed.push(sql);
      if (state.failOn && sql.includes(state.failOn)) throw new Error('boom');
      const m = /PRAGMA user_version = (\d+)/.exec(sql);
      if (m) state.version = Number(m[1]);
    },
  };
  return { db, state };
}

describe('runMigrations', () => {
  it('applies all pending migrations and sets version', async () => {
    const { db, state } = fakeDb();
    const v = await runMigrations(db, migrations);
    expect(v).toBe(migrations[migrations.length - 1]!.version);
    expect(state.executed.join('\n')).toContain('CREATE TABLE outbox');
  });

  it('is idempotent', async () => {
    const { db, state } = fakeDb();
    await runMigrations(db, migrations);
    const count = state.executed.length;
    await runMigrations(db, migrations);
    expect(state.executed.length).toBe(count);
  });

  it('outbox has the required columns', () => {
    const sql = migrations[0]!.sql;
    for (const col of [
      'id',
      'entity',
      'operation',
      'payload',
      'created_at',
      'attempts',
      'last_error',
    ]) {
      expect(sql).toContain(col);
    }
  });

  it('rolls back and rethrows on failure', async () => {
    const { db, state } = fakeDb();
    state.failOn = 'CREATE TABLE';
    await expect(runMigrations(db, migrations)).rejects.toThrow('boom');
    expect(state.executed).toContain('ROLLBACK;');
    expect(state.version).toBe(0);
  });

  it('rejects non-increasing versions', async () => {
    const { db } = fakeDb();
    await expect(
      runMigrations(db, [
        { version: 2, name: 'a', sql: '' },
        { version: 1, name: 'b', sql: '' },
      ]),
    ).rejects.toThrow(/increasing/);
  });
});
