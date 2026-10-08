export interface GuestEntry {
  id: string;
  entity: string;
  payload: Record<string, unknown>;
  created_at: string;
  migrated_at: string | null;
}

export interface GuestMigrationResult {
  migratedCount: number;
  entryIds: string[];
}

export interface GuestDb {
  runAsync(sql: string, ...params: unknown[]): Promise<unknown>;
  getAllAsync<T>(sql: string): Promise<T[]>;
}

/**
 * Saves a local guest action before the user has signed up / logged in.
 * PRD AUTH-2: "A new user can finish onboarding and log meals before creating an account."
 */
export async function recordGuestEntry(
  db: GuestDb,
  entry: { id: string; entity: string; payload: Record<string, unknown>; createdAt?: string },
): Promise<void> {
  const createdAt = entry.createdAt ?? new Date().toISOString();
  await db.runAsync(
    `INSERT INTO guest_entries (id, entity, payload, created_at, migrated_at)
     VALUES (?, ?, ?, ?, NULL)`,
    [entry.id, entry.entity, JSON.stringify(entry.payload), createdAt],
  );
}

/**
 * Fetches all unmigrated guest records from local SQLite.
 */
export async function getPendingGuestEntries(
  db: Pick<GuestDb, 'getAllAsync'>,
): Promise<GuestEntry[]> {
  const rows = await db.getAllAsync<{
    id: string;
    entity: string;
    payload: string;
    created_at: string;
    migrated_at: string | null;
  }>(
    `SELECT id, entity, payload, created_at, migrated_at FROM guest_entries WHERE migrated_at IS NULL ORDER BY created_at ASC`,
  );

  return rows.map((r) => ({
    id: r.id,
    entity: r.entity,
    payload: JSON.parse(r.payload) as Record<string, unknown>,
    created_at: r.created_at,
    migrated_at: r.migrated_at,
  }));
}

/**
 * Migrates local guest data to the authenticated user account.
 * Moves pending guest records into the SQLite outbox queue for idempotent sync to Supabase,
 * and marks them as migrated locally.
 */
export async function migrateGuestData(db: GuestDb, userId: string): Promise<GuestMigrationResult> {
  const pending = await getPendingGuestEntries(db);
  if (pending.length === 0) {
    return { migratedCount: 0, entryIds: [] };
  }

  const migratedAt = new Date().toISOString();
  const migratedIds: string[] = [];

  for (const item of pending) {
    const updatedPayload = {
      ...item.payload,
      userId,
      synced_from_guest: true,
    };

    await db.runAsync(
      `INSERT INTO outbox (id, entity, operation, payload, created_at, attempts, last_error)
       VALUES (?, ?, 'upsert', ?, ?, 0, NULL)
       ON CONFLICT (id) DO UPDATE SET payload = excluded.payload`,
      [item.id, item.entity, JSON.stringify(updatedPayload), migratedAt],
    );

    await db.runAsync(`UPDATE guest_entries SET migrated_at = ? WHERE id = ?`, [
      migratedAt,
      item.id,
    ]);

    migratedIds.push(item.id);
  }

  return {
    migratedCount: migratedIds.length,
    entryIds: migratedIds,
  };
}
