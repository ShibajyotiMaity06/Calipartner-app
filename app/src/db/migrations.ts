/**
 * Versioned local migrations for the on-device SQLite database.
 * Rules: append new migrations to the end; never edit or reorder committed ones.
 */
export interface LocalMigration {
  version: number;
  name: string;
  sql: string;
}

export const migrations: readonly LocalMigration[] = [
  {
    version: 1,
    name: 'create_outbox',
    sql: `
      CREATE TABLE outbox (
        id         TEXT PRIMARY KEY NOT NULL,
        entity     TEXT NOT NULL,
        operation  TEXT NOT NULL,
        payload    TEXT NOT NULL,            -- JSON
        created_at TEXT NOT NULL,            -- ISO-8601 UTC
        attempts   INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      );
      CREATE INDEX idx_outbox_created_at ON outbox (created_at);
    `,
  },
  {
    version: 2,
    name: 'create_guest_entries',
    sql: `
      CREATE TABLE guest_entries (
        id          TEXT PRIMARY KEY NOT NULL,
        entity      TEXT NOT NULL,
        payload     TEXT NOT NULL,            -- JSON
        created_at  TEXT NOT NULL,            -- ISO-8601 UTC
        migrated_at TEXT                      -- ISO-8601 UTC once transferred to account
      );
      CREATE INDEX idx_guest_entries_migrated ON guest_entries (migrated_at);
    `,
  },
];
