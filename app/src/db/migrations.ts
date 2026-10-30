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
  {
    version: 5,
    name: 'create_phase4_trackers',
    sql: `
      CREATE TABLE IF NOT EXISTS local_water_logs (
        id              TEXT PRIMARY KEY NOT NULL,
        user_id         TEXT NOT NULL,
        amount_ml       INTEGER NOT NULL,
        logged_at       TEXT NOT NULL,
        local_date      TEXT NOT NULL,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT,
        sync_state      TEXT NOT NULL DEFAULT 'pending'
      );
      CREATE INDEX IF NOT EXISTS idx_local_water_user_date ON local_water_logs (user_id, local_date, deleted_at);
      CREATE INDEX IF NOT EXISTS idx_local_water_sync_state ON local_water_logs (sync_state);

      CREATE TABLE IF NOT EXISTS local_weight_logs (
        id              TEXT PRIMARY KEY NOT NULL,
        user_id         TEXT NOT NULL,
        weight_kg       REAL NOT NULL,
        logged_at       TEXT NOT NULL,
        local_date      TEXT NOT NULL,
        notes           TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT,
        sync_state      TEXT NOT NULL DEFAULT 'pending'
      );
      CREATE INDEX IF NOT EXISTS idx_local_weight_user_date ON local_weight_logs (user_id, local_date, deleted_at);
      CREATE INDEX IF NOT EXISTS idx_local_weight_sync_state ON local_weight_logs (sync_state);

      CREATE TABLE IF NOT EXISTS local_activity_days (
        id              TEXT PRIMARY KEY NOT NULL,
        user_id         TEXT NOT NULL,
        local_date      TEXT NOT NULL,
        steps           INTEGER NOT NULL DEFAULT 0,
        distance_m      REAL NOT NULL DEFAULT 0,
        source          TEXT NOT NULL,
        active_calories INTEGER DEFAULT 0,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT,
        sync_state      TEXT NOT NULL DEFAULT 'pending',
        UNIQUE (user_id, local_date)
      );
      CREATE INDEX IF NOT EXISTS idx_local_activity_user_date ON local_activity_days (user_id, local_date);
      CREATE INDEX IF NOT EXISTS idx_local_activity_sync_state ON local_activity_days (sync_state);
    `,
  },
  {
    version: 6,
    name: 'create_phase6_workouts_and_exercises',
    sql: `
      CREATE TABLE IF NOT EXISTS local_exercises (
        id              TEXT PRIMARY KEY NOT NULL,
        name            TEXT NOT NULL,
        muscle_group    TEXT NOT NULL,
        equipment       TEXT NOT NULL,
        type            TEXT NOT NULL,
        owner_id        TEXT,
        attribution     TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT,
        sync_state      TEXT NOT NULL DEFAULT 'synced'
      );
      CREATE INDEX IF NOT EXISTS idx_local_exercises_name ON local_exercises (name);
      CREATE INDEX IF NOT EXISTS idx_local_exercises_muscle ON local_exercises (muscle_group);
      CREATE INDEX IF NOT EXISTS idx_local_exercises_owner ON local_exercises (owner_id);

      CREATE TABLE IF NOT EXISTS local_workouts (
        id                TEXT PRIMARY KEY NOT NULL,
        user_id           TEXT NOT NULL,
        type              TEXT NOT NULL,
        name              TEXT,
        start_time        TEXT,
        duration_minutes  INTEGER NOT NULL DEFAULT 0,
        local_date        TEXT NOT NULL,
        notes             TEXT,
        effort_rating     INTEGER,
        created_at        TEXT NOT NULL,
        updated_at        TEXT NOT NULL,
        deleted_at        TEXT,
        sync_state        TEXT NOT NULL DEFAULT 'pending'
      );
      CREATE INDEX IF NOT EXISTS idx_local_workouts_user_date ON local_workouts (user_id, local_date, deleted_at);
      CREATE INDEX IF NOT EXISTS idx_local_workouts_sync_state ON local_workouts (sync_state);

      CREATE TABLE IF NOT EXISTS local_workout_exercises (
        id                TEXT PRIMARY KEY NOT NULL,
        workout_id        TEXT NOT NULL,
        user_id           TEXT NOT NULL,
        exercise_id       TEXT,
        exercise_name     TEXT NOT NULL,
        order_in_workout  INTEGER NOT NULL DEFAULT 0,
        notes             TEXT,
        created_at        TEXT NOT NULL,
        updated_at        TEXT NOT NULL,
        deleted_at        TEXT,
        sync_state        TEXT NOT NULL DEFAULT 'pending'
      );
      CREATE INDEX IF NOT EXISTS idx_local_we_workout ON local_workout_exercises (workout_id, order_in_workout, deleted_at);
      CREATE INDEX IF NOT EXISTS idx_local_we_user_ex ON local_workout_exercises (user_id, exercise_id);
      CREATE INDEX IF NOT EXISTS idx_local_we_sync_state ON local_workout_exercises (sync_state);

      CREATE TABLE IF NOT EXISTS local_workout_sets (
        id                  TEXT PRIMARY KEY NOT NULL,
        workout_exercise_id TEXT NOT NULL,
        workout_id          TEXT NOT NULL,
        user_id             TEXT NOT NULL,
        set_number          INTEGER NOT NULL DEFAULT 1,
        reps                INTEGER,
        weight_kg           REAL,
        duration_seconds    INTEGER,
        distance_meters     REAL,
        is_warmup           INTEGER NOT NULL DEFAULT 0,
        completed           INTEGER NOT NULL DEFAULT 1,
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL,
        deleted_at          TEXT,
        sync_state          TEXT NOT NULL DEFAULT 'pending'
      );
      CREATE INDEX IF NOT EXISTS idx_local_ws_exercise ON local_workout_sets (workout_exercise_id, set_number, deleted_at);
      CREATE INDEX IF NOT EXISTS idx_local_ws_workout ON local_workout_sets (workout_id);
      CREATE INDEX IF NOT EXISTS idx_local_ws_sync_state ON local_workout_sets (sync_state);

      CREATE TABLE IF NOT EXISTS local_workout_timers (
        id                  TEXT PRIMARY KEY NOT NULL,
        workout_id          TEXT,
        started_at          TEXT NOT NULL,
        paused_at           TEXT,
        total_paused_ms     INTEGER NOT NULL DEFAULT 0,
        is_running          INTEGER NOT NULL DEFAULT 1,
        updated_at          TEXT NOT NULL
      );
    `,
  },
  {
    version: 8,
    name: 'create_chat_and_attachments',
    sql: `
      CREATE TABLE IF NOT EXISTS local_chat_messages (
        id                 TEXT PRIMARY KEY NOT NULL,
        client_id          TEXT UNIQUE NOT NULL,
        room_id            TEXT NOT NULL,
        sender_id          TEXT,
        sender_nickname    TEXT,
        sender_username    TEXT,
        sender_avatar_url  TEXT,
        message_type       TEXT NOT NULL DEFAULT 'user',
        system_event_type  TEXT,
        text               TEXT,
        created_at         TEXT NOT NULL,
        deleted_at         TEXT,
        delivery_status    TEXT NOT NULL DEFAULT 'sent',
        sync_state         TEXT NOT NULL DEFAULT 'synced',
        last_error         TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_local_chat_room_created ON local_chat_messages (room_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_local_chat_client_id ON local_chat_messages (client_id);
      CREATE INDEX IF NOT EXISTS idx_local_chat_delivery ON local_chat_messages (delivery_status);

      CREATE TABLE IF NOT EXISTS local_chat_attachments (
        id                 TEXT PRIMARY KEY NOT NULL,
        message_id         TEXT NOT NULL,
        storage_key        TEXT NOT NULL,
        local_uri          TEXT,
        width              INTEGER,
        height             INTEGER,
        size               INTEGER NOT NULL,
        mime_type          TEXT NOT NULL,
        moderation_status  TEXT NOT NULL DEFAULT 'pending',
        upload_status      TEXT NOT NULL DEFAULT 'uploaded',
        created_at         TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_local_chat_att_msg ON local_chat_attachments (message_id);

      CREATE TABLE IF NOT EXISTS local_chat_read_state (
        room_id              TEXT NOT NULL,
        user_id              TEXT NOT NULL,
        last_read_message_id TEXT,
        last_read_at         TEXT NOT NULL,
        unread_count         INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (room_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS local_chat_room_settings (
        room_id              TEXT NOT NULL,
        user_id              TEXT NOT NULL,
        mute_system_messages INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (room_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS local_consent_records (
        user_id      TEXT NOT NULL,
        consent_type TEXT NOT NULL,
        version      TEXT NOT NULL,
        accepted_at  TEXT NOT NULL,
        PRIMARY KEY (user_id, consent_type)
      );
    `,
  },
  {
    version: 9,
    name: 'create_focus_sessions_and_settings',
    sql: `
      CREATE TABLE IF NOT EXISTS local_focus_sessions (
        id                TEXT PRIMARY KEY NOT NULL,
        user_id           TEXT NOT NULL,
        room_session_id   TEXT,
        mode              TEXT NOT NULL,
        label             TEXT,
        planned_seconds   INTEGER,
        started_at        TEXT NOT NULL,
        ended_at          TEXT,
        paused_seconds    INTEGER NOT NULL DEFAULT 0,
        last_paused_at    TEXT,
        status            TEXT NOT NULL DEFAULT 'active',
        source            TEXT NOT NULL DEFAULT 'personal',
        created_at        TEXT NOT NULL,
        updated_at        TEXT NOT NULL,
        sync_state        TEXT NOT NULL DEFAULT 'pending'
      );
      CREATE INDEX IF NOT EXISTS idx_local_focus_user_started ON local_focus_sessions (user_id, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_local_focus_sync_state ON local_focus_sessions (sync_state);

      CREATE TABLE IF NOT EXISTS local_focus_settings (
        user_id                TEXT PRIMARY KEY NOT NULL,
        weekly_goal_minutes    INTEGER NOT NULL DEFAULT 300,
        streak_minimum_minutes INTEGER NOT NULL DEFAULT 25,
        break_reminders        INTEGER NOT NULL DEFAULT 1,
        default_label          TEXT,
        created_at             TEXT NOT NULL,
        updated_at             TEXT NOT NULL,
        sync_state             TEXT NOT NULL DEFAULT 'synced'
      );
    `,
  },
  {
    version: 10,
    name: 'create_recipe_tables',
    sql: `
      CREATE TABLE IF NOT EXISTS local_recipes (
        id                         TEXT PRIMARY KEY NOT NULL,
        title                      TEXT NOT NULL,
        description                TEXT,
        cuisine                    TEXT NOT NULL,
        diet_tags                  TEXT NOT NULL,
        meal_type                  TEXT NOT NULL,
        prep_minutes               INTEGER NOT NULL DEFAULT 0,
        cook_minutes               INTEGER NOT NULL DEFAULT 0,
        difficulty                 TEXT NOT NULL,
        servings                   REAL NOT NULL,
        steps                      TEXT NOT NULL,
        tips                       TEXT NOT NULL,
        image_urls                 TEXT NOT NULL,
        status                     TEXT NOT NULL,
        nutrition_per_serving      TEXT NOT NULL,
        nutrition_override_reason  TEXT,
        version                    INTEGER NOT NULL DEFAULT 1,
        created_at                 TEXT NOT NULL,
        updated_at                 TEXT NOT NULL,
        cached_at                  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_local_recipes_cuisine ON local_recipes (cuisine);
      CREATE INDEX IF NOT EXISTS idx_local_recipes_meal_type ON local_recipes (meal_type);
      CREATE INDEX IF NOT EXISTS idx_local_recipes_updated_at ON local_recipes (updated_at DESC);

      CREATE TABLE IF NOT EXISTS local_recipe_ingredients (
        id            TEXT PRIMARY KEY NOT NULL,
        recipe_id     TEXT NOT NULL,
        food_id       TEXT NOT NULL,
        food_name     TEXT,
        quantity      REAL NOT NULL,
        unit          TEXT NOT NULL,
        note          TEXT,
        display_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_local_recipe_ingredients_recipe ON local_recipe_ingredients (recipe_id);

      CREATE TABLE IF NOT EXISTS local_recipe_favorites (
        user_id    TEXT NOT NULL,
        recipe_id  TEXT NOT NULL,
        created_at TEXT NOT NULL,
        sync_state TEXT NOT NULL DEFAULT 'synced',
        deleted_at TEXT,
        PRIMARY KEY (user_id, recipe_id)
      );
      CREATE INDEX IF NOT EXISTS idx_local_recipe_favorites_user ON local_recipe_favorites (user_id);

      CREATE TABLE IF NOT EXISTS local_recipe_recently_viewed (
        user_id    TEXT NOT NULL,
        recipe_id  TEXT NOT NULL,
        viewed_at  TEXT NOT NULL,
        PRIMARY KEY (user_id, recipe_id)
      );
      CREATE INDEX IF NOT EXISTS idx_local_recipe_viewed_user ON local_recipe_recently_viewed (user_id, viewed_at DESC);

      CREATE TABLE IF NOT EXISTS local_recipe_reports (
        id         TEXT PRIMARY KEY NOT NULL,
        recipe_id  TEXT NOT NULL,
        user_id    TEXT NOT NULL,
        reason     TEXT NOT NULL,
        details    TEXT,
        status     TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL,
        sync_state TEXT NOT NULL DEFAULT 'pending'
      );
      CREATE INDEX IF NOT EXISTS idx_local_recipe_reports_user ON local_recipe_reports (user_id);
    `,
  },
  {
    version: 11,
    name: 'create_fasting_tables',
    sql: `
      CREATE TABLE IF NOT EXISTS local_fasting_settings (
        user_id              TEXT PRIMARY KEY NOT NULL,
        enabled              INTEGER NOT NULL DEFAULT 0,
        protocol             TEXT NOT NULL DEFAULT '16:8',
        eating_window_start  TEXT NOT NULL DEFAULT '12:00',
        eating_window_end    TEXT NOT NULL DEFAULT '20:00',
        custom_fasting_hours INTEGER,
        created_at           TEXT NOT NULL,
        updated_at           TEXT NOT NULL,
        sync_state           TEXT NOT NULL DEFAULT 'synced'
      );

      CREATE TABLE IF NOT EXISTS local_fasting_sessions (
        id              TEXT PRIMARY KEY NOT NULL,
        user_id         TEXT NOT NULL,
        start_at        TEXT NOT NULL,
        planned_minutes INTEGER NOT NULL,
        end_at          TEXT,
        status          TEXT NOT NULL DEFAULT 'active',
        local_date      TEXT NOT NULL,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        sync_state      TEXT NOT NULL DEFAULT 'synced'
      );
      CREATE INDEX IF NOT EXISTS idx_local_fasting_sessions_user_status ON local_fasting_sessions (user_id, status);
      CREATE INDEX IF NOT EXISTS idx_local_fasting_sessions_user_start ON local_fasting_sessions (user_id, start_at DESC);
      CREATE INDEX IF NOT EXISTS idx_local_fasting_sessions_user_date ON local_fasting_sessions (user_id, local_date DESC);
    `,
  },
  {
    version: 12,
    name: 'onboarding_gym_days',
    sql: `
      ALTER TABLE local_goal_profiles ADD COLUMN gym_days INTEGER CHECK (gym_days BETWEEN 0 AND 7);
      ALTER TABLE local_goal_profiles ADD COLUMN input_height_cm REAL CHECK (input_height_cm BETWEEN 50 AND 300);
      CREATE TABLE local_onboarding_drafts (
        user_id TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 13,
    name: 'social_profiles_friend_outbox',
    sql: `
      CREATE TABLE local_social_cache (
        id TEXT PRIMARY KEY NOT NULL,
        owner_id TEXT NOT NULL,
        cache_key TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX local_social_cache_owner ON local_social_cache(owner_id,cache_key);
      CREATE TABLE local_social_outbox (
        id TEXT PRIMARY KEY NOT NULL,
        owner_id TEXT NOT NULL,
        rpc_name TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        last_error TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX local_social_outbox_owner ON local_social_outbox(owner_id,created_at);
    `,
  },
  {
    version: 14,
    name: 'preserve_additional_scan_nutrition',
    sql: `
      ALTER TABLE local_foods ADD COLUMN nutrition_details TEXT;
      ALTER TABLE local_food_entries ADD COLUMN nutrition_details TEXT;
    `,
  },
  {
    version: 15,
    name: 'challenge_cache_and_outbox',
    sql: `CREATE TABLE local_challenge_cache (id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE local_challenge_outbox (id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL, last_error TEXT, created_at TEXT NOT NULL);
      CREATE INDEX local_challenge_pending ON local_challenge_outbox(owner_id,created_at);`,
  },
  {
    version: 16,
    name: 'custom_macro_goals',
    sql: 'ALTER TABLE local_goal_profiles ADD COLUMN custom_macros INTEGER NOT NULL DEFAULT 0;',
  },
];
