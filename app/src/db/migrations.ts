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
  {
    version: 3,
    name: 'create_goal_profiles_and_health_screening',
    sql: `
      CREATE TABLE IF NOT EXISTS local_goal_profiles (
        id                   TEXT PRIMARY KEY NOT NULL,
        user_id              TEXT NOT NULL,
        goal                 TEXT NOT NULL,
        activity_level       TEXT NOT NULL,
        current_weight_kg    REAL NOT NULL,
        body_fat_percentage  REAL,
        weekly_rate_kg       REAL NOT NULL,
        target_weight_kg     REAL,
        target_date          TEXT,
        daily_calorie_target INTEGER NOT NULL,
        protein_grams        INTEGER NOT NULL,
        fat_grams            INTEGER NOT NULL,
        carb_grams           INTEGER NOT NULL,
        bmr                  INTEGER NOT NULL,
        tdee                 INTEGER NOT NULL,
        step_goal            INTEGER NOT NULL DEFAULT 8000,
        water_ml_goal        INTEGER NOT NULL DEFAULT 2500,
        effective_from       TEXT NOT NULL,
        confirmed_at         TEXT NOT NULL,
        recompute_reason     TEXT,
        created_at           TEXT NOT NULL,
        is_synced            INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_local_goal_profiles_user ON local_goal_profiles (user_id, effective_from DESC);

      CREATE TABLE IF NOT EXISTS local_health_screening (
        user_id                     TEXT PRIMARY KEY NOT NULL,
        pregnant_or_breastfeeding   INTEGER NOT NULL DEFAULT 0,
        has_diabetes_or_medication  INTEGER NOT NULL DEFAULT 0,
        has_eating_disorder_history INTEGER NOT NULL DEFAULT 0,
        updated_at                  TEXT NOT NULL,
        created_at                  TEXT NOT NULL,
        is_synced                   INTEGER NOT NULL DEFAULT 0
      );
    `,
  },
];

