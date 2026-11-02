const server = vi.hoisted(() => ({ upsert: vi.fn().mockResolvedValue({ error: null }) }));
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ from: () => ({ upsert: server.upsert }) }),
}));
import { describe, expect, it, vi } from 'vitest';
import {
  getPendingGuestEntries,
  migrateGuestData,
  recordGuestEntry,
  type GuestDb,
} from './guestMigration';

interface Row {
  id: string;
  entity: string;
  payload: string;
  created_at: string;
  migrated_at: string | null;
}

function createFakeDb() {
  const guestRows: Row[] = [];
  const outboxRows: Record<string, unknown>[] = [];

  const db: GuestDb = {
    async runAsync(sql: string, ...args: unknown[]) {
      const params = (Array.isArray(args[0]) ? args[0] : args) as unknown[];
      if (sql.includes('INSERT INTO guest_entries')) {
        const [id, entity, payload, created_at] = params as [string, string, string, string];
        guestRows.push({ id, entity, payload, created_at, migrated_at: null });
      } else if (sql.includes('INSERT INTO outbox')) {
        const [id, entity, payload, created_at] = params as [string, string, string, string];
        outboxRows.push({ id, entity, operation: 'upsert', payload, created_at });
      } else if (sql.includes('UPDATE guest_entries SET migrated_at')) {
        const [migrated_at, id] = params as [string, string];
        const row = guestRows.find((r) => r.id === id);
        if (row) row.migrated_at = migrated_at;
      }
    },
    async getAllAsync<T>(sql: string): Promise<T[]> {
      if (sql.includes('FROM guest_entries WHERE migrated_at IS NULL')) {
        return guestRows.filter((r) => r.migrated_at === null) as unknown as T[];
      }
      return [] as T[];
    },
  };

  return { db, guestRows, outboxRows };
}

describe('guestMigrationService', () => {
  it('records guest entry and marks unmigrated', async () => {
    const { db } = createFakeDb();
    await recordGuestEntry(db, {
      id: 'entry-1',
      entity: 'placeholder_log',
      payload: { food: 'Apple', calories: 95 },
    });

    const pending = await getPendingGuestEntries(db);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.id).toBe('entry-1');
    expect(pending[0]!.payload).toEqual({ food: 'Apple', calories: 95 });
    expect(pending[0]!.migrated_at).toBeNull();
  });

  it('migrates local guest entries to user account via outbox queue', async () => {
    const { db, guestRows } = createFakeDb();

    await recordGuestEntry(db, {
      id: 'entry-1',
      entity: 'placeholder_log',
      payload: { food: 'Apple', calories: 95 },
    });
    await recordGuestEntry(db, {
      id: 'entry-2',
      entity: 'placeholder_log',
      payload: { food: 'Banana', calories: 105 },
    });

    const result = await migrateGuestData(db, 'user-123');
    expect(result.migratedCount).toBe(2);
    expect(result.entryIds).toEqual(['entry-1', 'entry-2']);

    expect(server.upsert).toHaveBeenCalledTimes(2);
    expect(server.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-123', food: 'Apple' }),
    );
    // Check that guest entries are marked migrated locally
    expect(guestRows.every((r) => r.migrated_at !== null)).toBe(true);

    // Pending entries should now be empty
    const remainingPending = await getPendingGuestEntries(db);
    expect(remainingPending).toHaveLength(0);
  });

  it('handles empty guest data gracefully', async () => {
    const { db } = createFakeDb();
    const result = await migrateGuestData(db, 'user-123');
    expect(result.migratedCount).toBe(0);
    expect(result.entryIds).toEqual([]);
  });
});
