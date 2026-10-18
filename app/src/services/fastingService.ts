import {
  calculateFastingProgress,
  calculateFastingStats,
  calculateFastingStreak,
  DEFAULT_FASTING_SETTINGS,
  validatePlannedMinutes,
  type FastingProtocol,
  type FastingSession,
  type FastingSettings,
  type FastingStats,
  type FastingStreak,
  type IndividualFastingProgress,
} from '@calipartner/core';
import { createLogger } from '@/lib/logger';
import {
  cancelFastingReminder,
  rescheduleAllFastingReminders,
  scheduleFastingReminder,
} from './localNotificationService';
import { enqueueOutbox, type SupabaseSyncClient, type SyncDb } from './syncService';

const log = createLogger('fastingService');

export type FastingErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_PLANNED_MINUTES'
  | 'UNDER_18_BLOCKED'
  | 'SCREENING_INELIGIBLE'
  | 'LOW_INTAKE_PAUSED'
  | 'SESSION_NOT_FOUND'
  | 'ACTIVE_SESSION_EXISTS'
  | 'UNKNOWN_ERROR';

export class FastingError extends Error {
  constructor(
    public readonly code: FastingErrorCode,
    message?: string,
  ) {
    super(message || code);
    this.name = 'FastingError';
  }
}

export function parseFastingError(err: unknown): FastingError {
  if (err instanceof FastingError) return err;

  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('UNAUTHENTICATED')) {
    return new FastingError('UNAUTHENTICATED', 'User is not signed in');
  }
  if (msg.includes('INVALID_PLANNED_MINUTES')) {
    return new FastingError(
      'INVALID_PLANNED_MINUTES',
      'Duration must be between 1 and 20 hours (60 to 1200 minutes)',
    );
  }
  if (msg.includes('UNDER_18_BLOCKED')) {
    return new FastingError(
      'UNDER_18_BLOCKED',
      'Fasting is available to users 18 and older only',
    );
  }
  if (msg.includes('SCREENING_INELIGIBLE')) {
    return new FastingError('SCREENING_INELIGIBLE', 'Fasting is not available based on health screening');
  }
  if (msg.includes('LOW_INTAKE_PAUSED')) {
    return new FastingError('LOW_INTAKE_PAUSED', 'Fasting is paused while low-intake check-in is active');
  }
  if (msg.includes('SESSION_NOT_FOUND')) {
    return new FastingError('SESSION_NOT_FOUND', 'Fasting session was not found');
  }
  if (msg.includes('Unique constraint') || msg.includes('idx_fasting_sessions_active_user')) {
    return new FastingError('ACTIVE_SESSION_EXISTS', 'An active fast is already in progress');
  }

  return new FastingError('UNKNOWN_ERROR', msg);
}

/**
 * Loads local fasting settings for user, or returns defaults if none exist.
 */
export async function getLocalFastingSettings(
  db: SyncDb,
  userId: string,
): Promise<FastingSettings> {
  const row = await db.getFirstAsync<{
    user_id: string;
    enabled: number;
    protocol: string;
    eating_window_start: string;
    eating_window_end: string;
    custom_fasting_hours: number | null;
    created_at: string;
    updated_at: string;
  }>(`SELECT * FROM local_fasting_settings WHERE user_id = ?`, [userId]);

  if (!row) {
    return {
      ...DEFAULT_FASTING_SETTINGS,
      user_id: userId,
    };
  }

  return {
    user_id: row.user_id,
    enabled: Boolean(row.enabled),
    protocol: row.protocol as FastingProtocol,
    eating_window_start: row.eating_window_start,
    eating_window_end: row.eating_window_end,
    custom_fasting_hours: row.custom_fasting_hours,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Saves fasting settings locally, enqueues to outbox, and reschedules reminders.
 */
export async function saveFastingSettings(
  db: SyncDb,
  supabase: SupabaseSyncClient | null,
  settings: FastingSettings,
  quietHoursSettings?: { enabled: boolean; start: string; end: string },
): Promise<FastingSettings> {
  const now = new Date().toISOString();
  const updatedSettings: FastingSettings = {
    ...settings,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO local_fasting_settings (
       user_id, enabled, protocol, eating_window_start, eating_window_end, custom_fasting_hours, created_at, updated_at, sync_state
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
     ON CONFLICT (user_id) DO UPDATE SET
       enabled = excluded.enabled,
       protocol = excluded.protocol,
       eating_window_start = excluded.eating_window_start,
       eating_window_end = excluded.eating_window_end,
       custom_fasting_hours = excluded.custom_fasting_hours,
       updated_at = excluded.updated_at,
       sync_state = 'pending'`,
    [
      updatedSettings.user_id,
      updatedSettings.enabled ? 1 : 0,
      updatedSettings.protocol,
      updatedSettings.eating_window_start,
      updatedSettings.eating_window_end,
      updatedSettings.custom_fasting_hours ?? null,
      updatedSettings.created_at,
      updatedSettings.updated_at,
    ],
  );

  // Enqueue outbox item
  await enqueueOutbox(db, {
    id: `fasting_settings_${updatedSettings.user_id}`,
    entity: 'fasting_settings',
    operation: 'upsert',
    payload: {
      user_id: updatedSettings.user_id,
      enabled: updatedSettings.enabled,
      protocol: updatedSettings.protocol,
      eating_window_start: updatedSettings.eating_window_start,
      eating_window_end: updatedSettings.eating_window_end,
      custom_fasting_hours: updatedSettings.custom_fasting_hours ?? null,
      created_at: updatedSettings.created_at,
      updated_at: updatedSettings.updated_at,
    },
  });

  // Reschedule local reminders using Phase 9 notification service
  const activeSession = await getActiveFastingSession(db, updatedSettings.user_id);
  await rescheduleAllFastingReminders({
    settings: updatedSettings,
    activeSession,
    quietHoursSettings,
  });

  log.info(`Saved fasting settings for ${updatedSettings.user_id}`);
  return updatedSettings;
}

/**
 * Retrieves the currently active fasting session for the user, if one exists.
 */
export async function getActiveFastingSession(
  db: SyncDb,
  userId: string,
): Promise<FastingSession | null> {
  const row = await db.getFirstAsync<{
    id: string;
    user_id: string;
    start_at: string;
    planned_minutes: number;
    end_at: string | null;
    status: string;
    local_date: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT * FROM local_fasting_sessions WHERE user_id = ? AND status = 'active' ORDER BY start_at DESC LIMIT 1`,
    [userId],
  );

  if (!row) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    start_at: row.start_at,
    planned_minutes: row.planned_minutes,
    end_at: row.end_at,
    status: row.status as FastingSession['status'],
    local_date: row.local_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Starts a new fasting session.
 * Idempotent, client-generated UUID, stored UTC timestamps.
 */
export async function startFast(
  db: SyncDb,
  supabase: SupabaseSyncClient | null,
  params: {
    userId: string;
    plannedMinutes: number;
    startAt?: string;
    localDate?: string;
    timezone?: string;
  },
): Promise<FastingSession> {
  const { userId, plannedMinutes, timezone = 'UTC' } = params;

  const validation = validatePlannedMinutes(plannedMinutes);
  if (!validation.valid) {
    throw new FastingError('INVALID_PLANNED_MINUTES', validation.error);
  }

  // Check if active session already exists
  const existingActive = await getActiveFastingSession(db, userId);
  if (existingActive) {
    throw new FastingError('ACTIVE_SESSION_EXISTS', 'An active fast is already running');
  }

  const now = new Date();
  const startAt = params.startAt ?? now.toISOString();
  const localDate =
    params.localDate ??
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(startAt));

  const sessionId = crypto.randomUUID ? crypto.randomUUID() : `fast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const session: FastingSession = {
    id: sessionId,
    user_id: userId,
    start_at: startAt,
    planned_minutes: plannedMinutes,
    end_at: null,
    status: 'active',
    local_date: localDate,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  // 1. Save to local SQLite
  await db.runAsync(
    `INSERT INTO local_fasting_sessions (
       id, user_id, start_at, planned_minutes, end_at, status, local_date, created_at, updated_at, sync_state
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      session.id,
      session.user_id,
      session.start_at,
      session.planned_minutes,
      session.end_at,
      session.status,
      session.local_date,
      session.created_at,
      session.updated_at,
    ],
  );

  // 2. Enqueue outbox for offline-first sync
  await enqueueOutbox(db, {
    id: session.id,
    entity: 'fasting_sessions',
    operation: 'upsert',
    payload: {
      id: session.id,
      user_id: session.user_id,
      start_at: session.start_at,
      planned_minutes: session.planned_minutes,
      end_at: session.end_at,
      status: session.status,
      local_date: session.local_date,
      created_at: session.created_at,
      updated_at: session.updated_at,
    },
  });

  // 3. Schedule fast end reminder
  const targetEndDate = new Date(new Date(startAt).getTime() + plannedMinutes * 60000);
  await scheduleFastingReminder({
    id: `fasting_end_${session.id}`,
    type: 'fast_end',
    targetDate: targetEndDate,
  });

  log.info(`Started fast ${session.id} for user ${userId} (${plannedMinutes} mins)`);
  return session;
}

/**
 * Ends an active fast.
 * Marks completed or ended_early neutrally, without penalties or shaming.
 */
export async function endFast(
  db: SyncDb,
  supabase: SupabaseSyncClient | null,
  params: {
    sessionId: string;
    userId: string;
    endAt?: string;
  },
): Promise<FastingSession> {
  const { sessionId, userId } = params;
  const now = new Date();
  const endAt = params.endAt ?? now.toISOString();

  const row = await db.getFirstAsync<{
    id: string;
    user_id: string;
    start_at: string;
    planned_minutes: number;
    end_at: string | null;
    status: string;
    local_date: string;
    created_at: string;
    updated_at: string;
  }>(`SELECT * FROM local_fasting_sessions WHERE id = ? AND user_id = ?`, [sessionId, userId]);

  if (!row) {
    throw new FastingError('SESSION_NOT_FOUND', 'Fasting session not found');
  }

  const startMs = new Date(row.start_at).getTime();
  const endMs = new Date(endAt).getTime();
  const elapsedMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));
  const newStatus = elapsedMinutes >= row.planned_minutes ? 'completed' : 'ended_early';

  const updatedSession: FastingSession = {
    id: row.id,
    user_id: row.user_id,
    start_at: row.start_at,
    planned_minutes: row.planned_minutes,
    end_at: endAt,
    status: newStatus,
    local_date: row.local_date,
    created_at: row.created_at,
    updated_at: now.toISOString(),
  };

  // 1. Update SQLite
  await db.runAsync(
    `UPDATE local_fasting_sessions
     SET end_at = ?, status = ?, updated_at = ?, sync_state = 'pending'
     WHERE id = ? AND user_id = ?`,
    [updatedSession.end_at, updatedSession.status, updatedSession.updated_at, sessionId, userId],
  );

  // 2. Enqueue outbox
  await enqueueOutbox(db, {
    id: updatedSession.id,
    entity: 'fasting_sessions',
    operation: 'upsert',
    payload: {
      id: updatedSession.id,
      user_id: updatedSession.user_id,
      start_at: updatedSession.start_at,
      planned_minutes: updatedSession.planned_minutes,
      end_at: updatedSession.end_at,
      status: updatedSession.status,
      local_date: updatedSession.local_date,
      created_at: updatedSession.created_at,
      updated_at: updatedSession.updated_at,
    },
  });

  // 3. Cancel fast end reminder
  await cancelFastingReminder(`fasting_end_${sessionId}`);

  log.info(`Ended fast ${sessionId}: ${newStatus} (${elapsedMinutes} mins)`);
  return updatedSession;
}

/**
 * Edits an existing session afterwards (PRD 6.20 FST-3).
 */
export async function editFastingSession(
  db: SyncDb,
  supabase: SupabaseSyncClient | null,
  params: {
    sessionId: string;
    userId: string;
    startAt?: string;
    endAt?: string | null;
    plannedMinutes?: number;
    localDate?: string;
  },
): Promise<FastingSession> {
  const { sessionId, userId } = params;

  const row = await db.getFirstAsync<{
    id: string;
    user_id: string;
    start_at: string;
    planned_minutes: number;
    end_at: string | null;
    status: string;
    local_date: string;
    created_at: string;
    updated_at: string;
  }>(`SELECT * FROM local_fasting_sessions WHERE id = ? AND user_id = ?`, [sessionId, userId]);

  if (!row) {
    throw new FastingError('SESSION_NOT_FOUND', 'Fasting session not found');
  }

  const startAt = params.startAt ?? row.start_at;
  const endAt = params.endAt !== undefined ? params.endAt : row.end_at;
  const plannedMinutes = params.plannedMinutes ?? row.planned_minutes;
  const localDate = params.localDate ?? row.local_date;

  const validation = validatePlannedMinutes(plannedMinutes);
  if (!validation.valid) {
    throw new FastingError('INVALID_PLANNED_MINUTES', validation.error);
  }

  let status = row.status;
  if (endAt) {
    const elapsedMinutes = Math.max(
      0,
      Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000),
    );
    status = elapsedMinutes >= plannedMinutes ? 'completed' : 'ended_early';
  } else {
    status = 'active';
  }

  const now = new Date().toISOString();
  const updatedSession: FastingSession = {
    id: row.id,
    user_id: row.user_id,
    start_at: startAt,
    planned_minutes: plannedMinutes,
    end_at: endAt,
    status: status as FastingSession['status'],
    local_date: localDate,
    created_at: row.created_at,
    updated_at: now,
  };

  await db.runAsync(
    `UPDATE local_fasting_sessions
     SET start_at = ?, end_at = ?, planned_minutes = ?, status = ?, local_date = ?, updated_at = ?, sync_state = 'pending'
     WHERE id = ? AND user_id = ?`,
    [
      updatedSession.start_at,
      updatedSession.end_at,
      updatedSession.planned_minutes,
      updatedSession.status,
      updatedSession.local_date,
      updatedSession.updated_at,
      sessionId,
      userId,
    ],
  );

  await enqueueOutbox(db, {
    id: updatedSession.id,
    entity: 'fasting_sessions',
    operation: 'upsert',
    payload: {
      id: updatedSession.id,
      user_id: updatedSession.user_id,
      start_at: updatedSession.start_at,
      planned_minutes: updatedSession.planned_minutes,
      end_at: updatedSession.end_at,
      status: updatedSession.status,
      local_date: updatedSession.local_date,
      created_at: updatedSession.created_at,
      updated_at: updatedSession.updated_at,
    },
  });

  // Reschedule reminder if still active
  if (updatedSession.status === 'active' && !updatedSession.end_at) {
    const targetEndDate = new Date(
      new Date(updatedSession.start_at).getTime() + updatedSession.planned_minutes * 60000,
    );
    await scheduleFastingReminder({
      id: `fasting_end_${updatedSession.id}`,
      type: 'fast_end',
      targetDate: targetEndDate,
    });
  } else {
    await cancelFastingReminder(`fasting_end_${sessionId}`);
  }

  log.info(`Edited fasting session ${sessionId}`);
  return updatedSession;
}

/**
 * Retrieves all fasting history for user.
 */
export async function getFastingHistory(
  db: SyncDb,
  userId: string,
  limit = 50,
): Promise<FastingSession[]> {
  const rows = await db.getAllAsync<{
    id: string;
    user_id: string;
    start_at: string;
    planned_minutes: number;
    end_at: string | null;
    status: string;
    local_date: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT * FROM local_fasting_sessions WHERE user_id = ? ORDER BY start_at DESC LIMIT ?`,
    [userId, limit],
  );

  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    start_at: r.start_at,
    planned_minutes: r.planned_minutes,
    end_at: r.end_at,
    status: r.status as FastingSession['status'],
    local_date: r.local_date,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

/**
 * Computes overall fasting stats for user.
 */
export async function getFastingStats(db: SyncDb, userId: string): Promise<FastingStats> {
  const history = await getFastingHistory(db, userId, 200);
  return calculateFastingStats(history);
}

/**
 * Computes personal fasting streak for user.
 */
export async function getFastingStreak(
  db: SyncDb,
  userId: string,
  timezone = 'UTC',
): Promise<FastingStreak> {
  const history = await getFastingHistory(db, userId, 200);
  return calculateFastingStreak(history, timezone);
}

/**
 * Computes weekly/range fasting progress for Progress tab (fasting hours/week).
 */
export async function getFastingProgressWeekly(
  db: SyncDb,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<IndividualFastingProgress> {
  const rows = await db.getAllAsync<{
    id: string;
    user_id: string;
    start_at: string;
    planned_minutes: number;
    end_at: string | null;
    status: string;
    local_date: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT * FROM local_fasting_sessions
     WHERE user_id = ? AND local_date BETWEEN ? AND ?
     ORDER BY local_date ASC`,
    [userId, startDate, endDate],
  );

  const sessions: FastingSession[] = rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    start_at: r.start_at,
    planned_minutes: r.planned_minutes,
    end_at: r.end_at,
    status: r.status as FastingSession['status'],
    local_date: r.local_date,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  return calculateFastingProgress(sessions, startDate, endDate);
}
