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
  {
    version: 4,
    name: 'create_foods_entries_and_sync_layer',
    sql: `
      ALTER TABLE outbox ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
      ALTER TABLE outbox ADD COLUMN next_retry_at TEXT;
      ALTER TABLE outbox ADD COLUMN updated_at TEXT;

      CREATE TABLE IF NOT EXISTS local_foods (
        id                  TEXT PRIMARY KEY NOT NULL,
        source              TEXT NOT NULL,
        name                TEXT NOT NULL,
        brand               TEXT,
        barcode             TEXT,
        serving_units       TEXT NOT NULL,
        calories_per_100g   REAL NOT NULL,
        protein_per_100g    REAL NOT NULL,
        carbs_per_100g      REAL NOT NULL,
        fat_per_100g        REAL NOT NULL,
        fiber_per_100g      REAL NOT NULL DEFAULT 0,
        sugar_per_100g      REAL NOT NULL DEFAULT 0,
        sodium_mg_per_100g  REAL NOT NULL DEFAULT 0,
        owner_id            TEXT,
        attribution         TEXT,
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL,
        deleted_at          TEXT,
        sync_state          TEXT NOT NULL DEFAULT 'synced'
      );
      CREATE INDEX IF NOT EXISTS idx_local_foods_name ON local_foods (name);
      CREATE INDEX IF NOT EXISTS idx_local_foods_barcode ON local_foods (barcode);
      CREATE INDEX IF NOT EXISTS idx_local_foods_owner ON local_foods (owner_id);

      CREATE TABLE IF NOT EXISTS local_food_entries (
        id              TEXT PRIMARY KEY NOT NULL,
        user_id         TEXT NOT NULL,
        food_id         TEXT,
        meal_section    TEXT NOT NULL,
        quantity        REAL NOT NULL,
        unit            TEXT NOT NULL,
        calories        REAL NOT NULL,
        protein         REAL NOT NULL,
        carbs           REAL NOT NULL,
        fat             REAL NOT NULL,
        fiber           REAL NOT NULL DEFAULT 0,
        sugar           REAL NOT NULL DEFAULT 0,
        sodium_mg       REAL NOT NULL DEFAULT 0,
        food_name       TEXT NOT NULL,
        brand_name      TEXT,
        logged_at       TEXT NOT NULL,
        local_date      TEXT NOT NULL,
        source          TEXT NOT NULL,
        shared_meal_id  TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT,
        sync_state      TEXT NOT NULL DEFAULT 'pending'
      );
      CREATE INDEX IF NOT EXISTS idx_local_entries_user_date ON local_food_entries (user_id, local_date, deleted_at);
      CREATE INDEX IF NOT EXISTS idx_local_entries_updated ON local_food_entries (updated_at);
      CREATE INDEX IF NOT EXISTS idx_local_entries_sync_state ON local_food_entries (sync_state);

      CREATE TABLE IF NOT EXISTS local_user_food_stats (
        user_id           TEXT NOT NULL,
        food_id           TEXT NOT NULL,
        use_count         INTEGER NOT NULL DEFAULT 1,
        last_used_at      TEXT NOT NULL,
        last_quantity     REAL NOT NULL,
        last_unit         TEXT NOT NULL,
        last_meal_section TEXT NOT NULL,
        hidden            INTEGER NOT NULL DEFAULT 0,
        updated_at        TEXT NOT NULL,
        sync_state        TEXT NOT NULL DEFAULT 'pending',
        PRIMARY KEY (user_id, food_id)
      );
      CREATE INDEX IF NOT EXISTS idx_local_food_stats_user_used ON local_user_food_stats (user_id, last_used_at DESC);

      CREATE TABLE IF NOT EXISTS local_saved_meals (
        id              TEXT PRIMARY KEY NOT NULL,
        user_id         TEXT NOT NULL,
        name            TEXT NOT NULL,
        items           TEXT NOT NULL,
        total_calories  REAL NOT NULL DEFAULT 0,
        total_protein   REAL NOT NULL DEFAULT 0,
        total_carbs     REAL NOT NULL DEFAULT 0,
        total_fat       REAL NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT,
        sync_state      TEXT NOT NULL DEFAULT 'pending'
      );
      CREATE INDEX IF NOT EXISTS idx_local_saved_meals_user ON local_saved_meals (user_id, updated_at);

      CREATE TABLE IF NOT EXISTS sync_cursors (
        entity          TEXT PRIMARY KEY NOT NULL,
        last_pulled_at  TEXT NOT NULL
      );
    `,
  },
];


