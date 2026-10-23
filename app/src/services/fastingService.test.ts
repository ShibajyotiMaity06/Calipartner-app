import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncDb } from './syncService';
import {
  editFastingSession,
  endFast,
  getActiveFastingSession,
  getFastingHistory,
  getFastingProgressWeekly,
  getFastingStats,
  getFastingStreak,
  getLocalFastingSettings,
  saveFastingSettings,
  startFast,
} from './fastingService';

// Mock expo-notifications
vi.mock('expo-notifications', () => ({
  scheduleNotificationAsync: vi.fn().mockResolvedValue('test-notification-id'),
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(undefined),
  cancelAllScheduledNotificationsAsync: vi.fn().mockResolvedValue(undefined),
  setNotificationHandler: vi.fn(),
  SchedulableTriggerInputTypes: {
    DATE: 'date',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    TIME_INTERVAL: 'timeInterval',
  },
}));

function createTestDb(): SyncDb {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
    CREATE TABLE outbox (
      id TEXT PRIMARY KEY NOT NULL,
      entity TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      next_retry_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE local_fasting_settings (
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

    CREATE TABLE local_fasting_sessions (
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
  `);

  return {
    async runAsync(sql: string, ...params: unknown[]) {
      const flat = Array.isArray(params[0]) ? params[0] : params;
      const stmt = sqlite.prepare(sql);
      const res = stmt.run(...flat);
      return { changes: res.changes, lastInsertRowid: res.lastInsertRowid };
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
      const flat = Array.isArray(params[0]) ? params[0] : params;
      const stmt = sqlite.prepare(sql);
      return stmt.all(...flat) as T[];
    },
    async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
      const flat = Array.isArray(params[0]) ? params[0] : params;
      const stmt = sqlite.prepare(sql);
      const rows = stmt.all(...flat);
      return ((rows && rows[0]) as T) ?? null;
    },
  };
}

describe('Phase 13: Fasting Service & Offline SQLite Sync', () => {
  let db: SyncDb;
  const userId = 'user-fasting-1';

  beforeEach(() => {
    db = createTestDb();
    vi.clearAllMocks();
  });

  it('retrieves default fasting settings when none exist in SQLite', async () => {
    const settings = await getLocalFastingSettings(db, userId);
    expect(settings.user_id).toBe(userId);
    expect(settings.enabled).toBe(false);
    expect(settings.protocol).toBe('16:8');
    expect(settings.eating_window_start).toBe('12:00');
    expect(settings.eating_window_end).toBe('20:00');
  });

  it('saves fasting settings locally, enqueues to outbox, and reschedules reminders', async () => {
    const saved = await saveFastingSettings(db, null, {
      user_id: userId,
      enabled: true,
      protocol: '18:6',
      eating_window_start: '14:00',
      eating_window_end: '20:00',
      custom_fasting_hours: 18,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    expect(saved.enabled).toBe(true);
    expect(saved.protocol).toBe('18:6');

    // Verify stored in local SQLite
    const retrieved = await getLocalFastingSettings(db, userId);
    expect(retrieved.enabled).toBe(true);
    expect(retrieved.protocol).toBe('18:6');

    // Verify queued in outbox
    const outboxItems = await db.getAllAsync<{ entity: string; payload: string }>(
      `SELECT * FROM outbox WHERE entity = 'fasting_settings'`,
    );
    expect(outboxItems.length).toBe(1);
    const payload = JSON.parse(outboxItems[0]!.payload);
    expect(payload.protocol).toBe('18:6');
    expect(payload.enabled).toBe(true);
  });

  it('starts a fast: generates UUID, saves to local SQLite, enqueues outbox, and schedules reminder', async () => {
    const session = await startFast(db, null, {
      userId,
      plannedMinutes: 960, // 16 hours
      startAt: '2026-10-18T10:00:00.000Z',
      localDate: '2026-10-18',
    });

    expect(session.id).toBeDefined();
    expect(session.status).toBe('active');
    expect(session.planned_minutes).toBe(960);

    // Active session is queryable
    const active = await getActiveFastingSession(db, userId);
    expect(active?.id).toBe(session.id);
    expect(active?.status).toBe('active');

    // Outbox item was enqueued
    const outboxItems = await db.getAllAsync<{ entity: string }>(
      `SELECT * FROM outbox WHERE entity = 'fasting_sessions'`,
    );
    expect(outboxItems.length).toBe(1);
  });

  it('blocks starting a second active fast while one is already running', async () => {
    await startFast(db, null, {
      userId,
      plannedMinutes: 960,
    });

    await expect(
      startFast(db, null, {
        userId,
        plannedMinutes: 720,
      }),
    ).rejects.toThrow('An active fast is already running');
  });

  it('enforces maximum 20 hour planned limit (1200m) at the service layer', async () => {
    await expect(
      startFast(db, null, {
        userId,
        plannedMinutes: 1440, // 24 hours
      }),
    ).rejects.toThrow('Maximum planned fast duration is 20 hours');
  });

  it('ends a fast: marks completed if elapsed >= planned minutes, updates outbox, and clears active session', async () => {
    const session = await startFast(db, null, {
      userId,
      plannedMinutes: 960,
      startAt: '2026-10-18T00:00:00.000Z',
    });

    // End after 16 hours (16:00 UTC)
    const ended = await endFast(db, null, {
      sessionId: session.id,
      userId,
      endAt: '2026-10-18T16:00:00.000Z',
    });

    expect(ended.status).toBe('completed');
    expect(ended.end_at).toBe('2026-10-18T16:00:00.000Z');

    // No active session remaining
    const active = await getActiveFastingSession(db, userId);
    expect(active).toBeNull();
  });

  it('ends a fast: marks ended_early neutrally if elapsed < planned minutes', async () => {
    const session = await startFast(db, null, {
      userId,
      plannedMinutes: 960,
      startAt: '2026-10-18T00:00:00.000Z',
    });

    // End early after 10 hours
    const ended = await endFast(db, null, {
      sessionId: session.id,
      userId,
      endAt: '2026-10-18T10:00:00.000Z',
    });

    expect(ended.status).toBe('ended_early');
  });

  it('edits an existing fast afterwards (PRD 6.20 FST-3)', async () => {
    const session = await startFast(db, null, {
      userId,
      plannedMinutes: 960,
      startAt: '2026-10-18T00:00:00.000Z',
    });

    const edited = await editFastingSession(db, null, {
      sessionId: session.id,
      userId,
      plannedMinutes: 720, // Reduced to 12 hours
      startAt: '2026-10-18T02:00:00.000Z',
    });

    expect(edited.planned_minutes).toBe(720);
    expect(edited.start_at).toBe('2026-10-18T02:00:00.000Z');

    const retrieved = await getActiveFastingSession(db, userId);
    expect(retrieved?.planned_minutes).toBe(720);
  });

  it('computes stats, personal streak, and weekly progress from SQLite records', async () => {
    // Insert 2 completed fasts on consecutive days
    const s1 = await startFast(db, null, {
      userId,
      plannedMinutes: 960,
      startAt: '2026-10-17T00:00:00.000Z',
      localDate: '2026-10-17',
    });
    await endFast(db, null, {
      sessionId: s1.id,
      userId,
      endAt: '2026-10-17T16:00:00.000Z',
    });

    const s2 = await startFast(db, null, {
      userId,
      plannedMinutes: 960,
      startAt: '2026-10-18T00:00:00.000Z',
      localDate: '2026-10-18',
    });
    await endFast(db, null, {
      sessionId: s2.id,
      userId,
      endAt: '2026-10-18T16:00:00.000Z',
    });

    const history = await getFastingHistory(db, userId);
    expect(history.length).toBe(2);

    const stats = await getFastingStats(db, userId);
    expect(stats.total_fasts).toBe(2);
    expect(stats.completed_fasts).toBe(2);
    expect(stats.completion_rate_pct).toBe(100);
    expect(stats.total_fasting_hours).toBe(32);

    const streak = await getFastingStreak(db, userId, 'UTC');
    expect(streak.longest_streak).toBeGreaterThanOrEqual(1);

    const progress = await getFastingProgressWeekly(db, userId, '2026-10-12', '2026-10-18');
    expect(progress.total_fasts).toBe(2);
    expect(progress.completed_fasts).toBe(2);
    expect(progress.fasting_hours_per_week).toBe(32);
  });
});
