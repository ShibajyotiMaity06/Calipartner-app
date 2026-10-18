import type {
  FocusErrorCode,
  FocusSession,
  FocusSessionMode,
  FocusSettings,
  PersonalFocusStats,
  RoomFocusParticipant,
  RoomFocusState,
  RoomWeeklyFocusStats,
} from '@calipartner/core';
import { getDefaultFocusSettings } from '@calipartner/core';
import { createLogger } from '@/lib/logger';
import { getSupabase } from '@/lib/supabase';
import {
  cancelFocusTimerEndReminder,
  scheduleFocusTimerEndReminder,
} from './localNotificationService';
import { enqueueOutbox, type SyncDb } from './syncService';

const log = createLogger('focusService');

export class FocusError extends Error {
  constructor(
    public readonly code: FocusErrorCode,
    message?: string,
  ) {
    super(message || code);
    this.name = 'FocusError';
  }
}

/**
 * Maps error messages or exceptions to typed FocusErrorCode.
 */
export function parseFocusError(err: unknown): FocusError {
  if (err instanceof FocusError) return err;

  let msg = '';
  if (err && typeof err === 'object') {
    const errObj = err as Record<string, unknown>;
    if (typeof errObj.message === 'string') {
      msg = errObj.message;
    } else if (typeof errObj.error === 'string') {
      msg = errObj.error;
    } else {
      try {
        msg = JSON.stringify(err);
      } catch {
        msg = String(err);
      }
    }
  } else {
    msg = String(err);
  }

  if (msg.includes('ROOM_LOCKED')) {
    return new FocusError('ROOM_LOCKED', 'This room is currently paused or locked.');
  }
  if (msg.includes('NOT_A_MEMBER') || msg.includes('NOT_ROOM_MEMBER')) {
    return new FocusError('NOT_A_MEMBER', 'You are not a member of this room.');
  }
  if (msg.includes('SESSION_ENDED') || msg.includes('SESSION_NOT_FOUND')) {
    return new FocusError('SESSION_ENDED', 'This focus session has already ended.');
  }
  if (msg.includes('RATE_LIMITED')) {
    return new FocusError(
      'RATE_LIMITED',
      'Daily room focus session limit reached (10 sessions/day).',
    );
  }
  if (msg.includes('SESSION_ALREADY_ACTIVE')) {
    return new FocusError(
      'SESSION_ALREADY_ACTIVE',
      'There is already an active focus session in this room.',
    );
  }
  if (msg.includes('UNAUTHENTICATED')) {
    return new FocusError('UNAUTHENTICATED', 'You must be signed in.');
  }
  return new FocusError('INVALID_ARGUMENT', msg);
}

// -----------------------------------------------------------------------------
// CLOCK OFFSET CORRECTION (PRD FOC-3, FOC-5)
// -----------------------------------------------------------------------------
let cachedServerOffsetMs = 0;
let lastClockSyncAt = 0;

export function getLastClockSyncAt(): number {
  return lastClockSyncAt;
}

/**
 * Synchronizes client clock offset against the database server_time().
 * Survives clock skew and local time changes.
 */
export async function syncServerClock(supabase = getSupabase()): Promise<number> {
  try {
    const t0 = Date.now();
    const { data, error } = await supabase.rpc('server_time');
    const t1 = Date.now();

    if (error || !data) {
      log.warn(`Clock sync rpc error: ${error?.message}`);
      return cachedServerOffsetMs;
    }

    const roundTripMs = t1 - t0;
    const serverTimestamp = new Date(data as string).getTime();
    // Approximate server time at t1: serverTimestamp + roundTripMs / 2
    cachedServerOffsetMs = serverTimestamp + Math.floor(roundTripMs / 2) - t1;
    lastClockSyncAt = Date.now();
    log.info(`Synchronized server clock offset: ${cachedServerOffsetMs} ms`);
    return cachedServerOffsetMs;
  } catch (err) {
    log.warn(`Failed to sync server clock: ${err}`);
    return cachedServerOffsetMs;
  }
}

/**
 * Returns current Date adjusted with the server clock offset.
 */
export function getServerCorrectedNow(): Date {
  return new Date(Date.now() + cachedServerOffsetMs);
}

export function getServerOffsetMs(): number {
  return cachedServerOffsetMs;
}

// -----------------------------------------------------------------------------
// PERSONAL FOCUS SESSIONS (OFFLINE VIA OUTBOX & LOCAL NOTIFICATIONS)
// -----------------------------------------------------------------------------

export interface StartPersonalFocusInput {
  id?: string;
  userId: string;
  mode: FocusSessionMode;
  label?: string | null;
  plannedSeconds?: number | null;
}

/**
 * Starts a personal focus session.
 * Idempotent via client UUID, writes locally to SQLite outbox, and sets local notification if timer.
 */
export async function startPersonalSession(
  db: SyncDb | null,
  input: StartPersonalFocusInput,
  supabase = getSupabase(),
): Promise<FocusSession> {
  const sessionId = input.id || crypto.randomUUID();
  const nowIso = getServerCorrectedNow().toISOString();

  const session: FocusSession = {
    id: sessionId,
    user_id: input.userId,
    mode: input.mode,
    label: input.label ? input.label.trim().slice(0, 20) : null,
    planned_seconds: input.plannedSeconds ?? null,
    started_at: nowIso,
    paused_seconds: 0,
    status: 'active',
    source: 'personal',
    created_at: nowIso,
    updated_at: nowIso,
  };

  // 1. Write to local SQLite if db provided
  if (db) {
    await db.runAsync(
      `INSERT INTO local_focus_sessions (
        id, user_id, mode, label, planned_seconds, started_at, paused_seconds, status, source, created_at, updated_at, sync_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      ON CONFLICT(id) DO UPDATE SET updated_at = ?`,
      [
        session.id,
        session.user_id,
        session.mode,
        session.label,
        session.planned_seconds,
        session.started_at,
        session.paused_seconds,
        session.status,
        session.source,
        session.created_at,
        session.updated_at,
        nowIso,
      ],
    );

    await enqueueOutbox(db, {
      id: session.id,
      entity: 'focus_sessions',
      operation: 'upsert',
      payload: { ...session },
    });
  }

  // 2. Schedule local notification for timer end (PRD FOC-3)
  if (session.mode === 'timer' && session.planned_seconds && session.planned_seconds > 0) {
    await scheduleFocusTimerEndReminder({
      sessionId: session.id,
      seconds: session.planned_seconds,
      label: session.label,
    });
  }

  // 3. Remote call if online
  try {
    const { data, error } = await supabase.rpc('start_personal_focus', {
      p_id: session.id,
      p_mode: session.mode,
      p_label: session.label,
      p_planned_seconds: session.planned_seconds,
    });
    if (!error && data) {
      if (db) {
        await db.runAsync(`UPDATE local_focus_sessions SET sync_state = 'synced' WHERE id = ?`, [
          session.id,
        ]);
      }
      return data as FocusSession;
    }
  } catch (err) {
    log.info(`Remote start_personal_focus deferred to offline sync: ${err}`);
  }

  return session;
}

/**
 * Pauses a personal focus session.
 */
export async function pausePersonalSession(
  db: SyncDb | null,
  sessionId: string,
  supabase = getSupabase(),
): Promise<void> {
  const nowIso = getServerCorrectedNow().toISOString();

  if (db) {
    await db.runAsync(
      `UPDATE local_focus_sessions
       SET status = 'paused', last_paused_at = ?, updated_at = ?, sync_state = 'pending'
       WHERE id = ?`,
      [nowIso, nowIso, sessionId],
    );

    await enqueueOutbox(db, {
      id: `${sessionId}_pause_${Date.now()}`,
      entity: 'focus_sessions',
      operation: 'upsert',
      payload: { id: sessionId, status: 'paused', last_paused_at: nowIso, updated_at: nowIso },
    });
  }

  // Cancel any running timer local reminder while paused
  await cancelFocusTimerEndReminder(sessionId);

  try {
    await supabase.rpc('pause_personal_focus', { p_id: sessionId });
  } catch (err) {
    log.info(`Remote pause deferred to offline sync: ${err}`);
  }
}

/**
 * Resumes a personal focus session.
 */
export async function resumePersonalSession(
  db: SyncDb | null,
  session: FocusSession,
  supabase = getSupabase(),
): Promise<void> {
  const now = getServerCorrectedNow();
  const nowIso = now.toISOString();

  let additionalPauseSeconds = 0;
  if (session.last_paused_at) {
    const pauseStartMs = new Date(session.last_paused_at).getTime();
    additionalPauseSeconds = Math.max(0, Math.floor((now.getTime() - pauseStartMs) / 1000));
  }
  const totalPaused = (session.paused_seconds || 0) + additionalPauseSeconds;

  if (db) {
    await db.runAsync(
      `UPDATE local_focus_sessions
       SET status = 'active', paused_seconds = ?, last_paused_at = NULL, updated_at = ?, sync_state = 'pending'
       WHERE id = ?`,
      [totalPaused, nowIso, session.id],
    );

    await enqueueOutbox(db, {
      id: `${session.id}_resume_${Date.now()}`,
      entity: 'focus_sessions',
      operation: 'upsert',
      payload: {
        id: session.id,
        status: 'active',
        paused_seconds: totalPaused,
        last_paused_at: null,
        updated_at: nowIso,
      },
    });
  }

  // Reschedule timer notification with remaining seconds if timer
  if (session.mode === 'timer' && session.planned_seconds) {
    const elapsedSoFar = Math.max(
      0,
      Math.floor((now.getTime() - new Date(session.started_at).getTime()) / 1000),
    );
    const netElapsed = Math.max(0, elapsedSoFar - totalPaused);
    const remaining = Math.max(0, session.planned_seconds - netElapsed);
    if (remaining > 0) {
      await scheduleFocusTimerEndReminder({
        sessionId: session.id,
        seconds: remaining,
        label: session.label,
      });
    }
  }

  try {
    await supabase.rpc('resume_personal_focus', { p_id: session.id });
  } catch (err) {
    log.info(`Remote resume deferred to offline sync: ${err}`);
  }
}

/**
 * Ends a personal focus session.
 */
export async function endPersonalSession(
  db: SyncDb | null,
  sessionId: string,
  session?: FocusSession,
  supabase = getSupabase(),
): Promise<void> {
  const now = getServerCorrectedNow();
  const nowIso = now.toISOString();

  let totalPaused = session?.paused_seconds || 0;
  if (session?.status === 'paused' && session.last_paused_at) {
    const pauseStartMs = new Date(session.last_paused_at).getTime();
    totalPaused += Math.max(0, Math.floor((now.getTime() - pauseStartMs) / 1000));
  }

  if (db) {
    await db.runAsync(
      `UPDATE local_focus_sessions
       SET status = 'ended', ended_at = ?, paused_seconds = ?, last_paused_at = NULL, updated_at = ?, sync_state = 'pending'
       WHERE id = ?`,
      [nowIso, totalPaused, nowIso, sessionId],
    );

    await enqueueOutbox(db, {
      id: `${sessionId}_end_${Date.now()}`,
      entity: 'focus_sessions',
      operation: 'upsert',
      payload: {
        id: sessionId,
        status: 'ended',
        ended_at: nowIso,
        paused_seconds: totalPaused,
        last_paused_at: null,
        updated_at: nowIso,
      },
    });
  }

  await cancelFocusTimerEndReminder(sessionId);

  try {
    await supabase.rpc('end_personal_focus', { p_id: sessionId });
  } catch (err) {
    log.info(`Remote end_personal_focus deferred: ${err}`);
  }
}

/**
 * Fetches the active personal session from local SQLite.
 */
export async function getLocalActivePersonalSession(
  db: SyncDb,
  userId: string,
): Promise<FocusSession | null> {
  return await db.getFirstAsync<FocusSession>(
    `SELECT * FROM local_focus_sessions
     WHERE user_id = ? AND status IN ('active', 'paused')
     ORDER BY started_at DESC LIMIT 1`,
    [userId],
  );
}

// -----------------------------------------------------------------------------
// ROOM FOCUS SESSIONS (PRD 6.25 FOC-5..FOC-9)
// -----------------------------------------------------------------------------

export async function startRoomFocus(
  roomId: string,
  mode: FocusSessionMode,
  label?: string | null,
  plannedSeconds?: number | null,
  supabase = getSupabase(),
): Promise<string> {
  const { data, error } = await supabase.rpc('start_room_focus', {
    p_room_id: roomId,
    p_mode: mode,
    p_label: label ? label.trim().slice(0, 20) : null,
    p_planned_seconds: plannedSeconds ?? null,
  });

  if (error) {
    throw parseFocusError(error);
  }

  return data as string;
}

export async function joinRoomFocus(
  sessionId: string,
  supabase = getSupabase(),
): Promise<RoomFocusParticipant> {
  const { data, error } = await supabase.rpc('join_room_focus', {
    p_session_id: sessionId,
  });

  if (error) {
    throw parseFocusError(error);
  }

  return data as RoomFocusParticipant;
}

export async function leaveRoomFocus(
  sessionId: string,
  supabase = getSupabase(),
): Promise<RoomFocusParticipant> {
  const { data, error } = await supabase.rpc('leave_room_focus', {
    p_session_id: sessionId,
  });

  if (error) {
    throw parseFocusError(error);
  }

  await cancelFocusTimerEndReminder(sessionId);
  return data as RoomFocusParticipant;
}

export async function pauseMyRoomFocus(
  sessionId: string,
  supabase = getSupabase(),
): Promise<RoomFocusParticipant> {
  const { data, error } = await supabase.rpc('pause_my_room_focus', {
    p_session_id: sessionId,
  });

  if (error) {
    throw parseFocusError(error);
  }

  await cancelFocusTimerEndReminder(sessionId);
  return data as RoomFocusParticipant;
}

export async function resumeMyRoomFocus(
  sessionId: string,
  supabase = getSupabase(),
): Promise<RoomFocusParticipant> {
  const { data, error } = await supabase.rpc('resume_my_room_focus', {
    p_session_id: sessionId,
  });

  if (error) {
    throw parseFocusError(error);
  }

  return data as RoomFocusParticipant;
}

export async function endRoomFocus(sessionId: string, supabase = getSupabase()): Promise<void> {
  const { error } = await supabase.rpc('end_room_focus', {
    p_session_id: sessionId,
  });

  if (error) {
    throw parseFocusError(error);
  }

  await cancelFocusTimerEndReminder(sessionId);
}

export async function getRoomFocus(
  roomId: string,
  supabase = getSupabase(),
): Promise<RoomFocusState> {
  const { data, error } = await supabase.rpc('get_room_focus', {
    p_room_id: roomId,
  });

  if (error) {
    throw parseFocusError(error);
  }

  return (data || { active_session: null, recent_sessions: [] }) as RoomFocusState;
}

// -----------------------------------------------------------------------------
// STATS & SETTINGS (PRD 6.15 PRG-14, RPG-8, FOC-10)
// -----------------------------------------------------------------------------

export async function getPersonalFocusStats(
  startDate?: string,
  endDate?: string,
  userId?: string,
  supabase = getSupabase(),
): Promise<PersonalFocusStats> {
  const { data, error } = await supabase.rpc('get_personal_focus_stats', {
    p_user_id: userId || null,
    p_start_date: startDate || null,
    p_end_date: endDate || null,
  });

  if (error) {
    throw parseFocusError(error);
  }

  return data as PersonalFocusStats;
}

export async function getRoomWeeklyFocusStats(
  roomId: string,
  weekStart?: string,
  supabase = getSupabase(),
): Promise<RoomWeeklyFocusStats> {
  const { data, error } = await supabase.rpc('get_room_weekly_focus_stats', {
    p_room_id: roomId,
    p_week_start: weekStart || null,
  });

  if (error) {
    throw parseFocusError(error);
  }

  return data as RoomWeeklyFocusStats;
}

export async function getFocusSettings(
  userId: string,
  supabase = getSupabase(),
): Promise<FocusSettings> {
  const { data, error } = await supabase
    .from('focus_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return getDefaultFocusSettings(userId);
  }

  return data as FocusSettings;
}

export async function updateFocusSettings(
  userId: string,
  settings: Partial<FocusSettings>,
  supabase = getSupabase(),
): Promise<FocusSettings> {
  const { data, error } = await supabase
    .from('focus_settings')
    .upsert({
      user_id: userId,
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    throw parseFocusError(error);
  }

  return data as FocusSettings;
}
