import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FocusSession } from '@calipartner/core';
import {
  endPersonalSession,
  FocusError,
  getServerCorrectedNow,
  parseFocusError,
  pausePersonalSession,
  resumePersonalSession,
  startPersonalSession,
  startRoomFocus,
  syncServerClock,
} from './focusService';
import type { SyncDb } from './syncService';

vi.mock('expo-notifications', () => ({
  scheduleNotificationAsync: vi.fn().mockResolvedValue('notif-focus-123'),
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(undefined),
  cancelAllScheduledNotificationsAsync: vi.fn().mockResolvedValue(undefined),
  setNotificationHandler: vi.fn(),
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    TIME_INTERVAL: 'timeInterval',
    DATE: 'date',
  },
}));

describe('Phase 9B: Focus Service & Client Data Layer', () => {
  let mockDb: SyncDb;
  let localSessionsTable: Map<string, Record<string, unknown>>;
  let outboxTable: Array<Record<string, unknown>>;

  beforeEach(() => {
    vi.clearAllMocks();
    localSessionsTable = new Map();
    outboxTable = [];

    mockDb = {
      runAsync: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('INSERT INTO local_focus_sessions')) {
          const [
            id,
            userId,
            mode,
            label,
            plannedSeconds,
            startedAt,
            pausedSeconds,
            status,
            source,
            createdAt,
            updatedAt,
          ] = params as [
            string,
            string,
            string,
            string | null,
            number | null,
            string,
            number,
            string,
            string,
            string,
            string,
          ];
          localSessionsTable.set(id, {
            id,
            user_id: userId,
            mode,
            label,
            planned_seconds: plannedSeconds,
            started_at: startedAt,
            paused_seconds: pausedSeconds,
            status,
            source,
            created_at: createdAt,
            updated_at: updatedAt,
            sync_state: 'pending',
          });
          return { changes: 1 };
        }
        if (sql.includes('UPDATE local_focus_sessions')) {
          const id = params[params.length - 1] as string;
          const existing = localSessionsTable.get(id);
          if (existing) {
            if (sql.includes("status = 'paused'")) {
              existing.status = 'paused';
              existing.last_paused_at = params[0];
            } else if (sql.includes("status = 'active'")) {
              existing.status = 'active';
              existing.paused_seconds = params[0];
              existing.last_paused_at = null;
            } else if (sql.includes("status = 'ended'")) {
              existing.status = 'ended';
              existing.ended_at = params[0];
              existing.paused_seconds = params[1];
              existing.last_paused_at = null;
            }
          }
          return { changes: 1 };
        }
        if (sql.includes('INSERT INTO outbox')) {
          const [id, entity, operation, payloadJson] = params as [string, string, string, string];
          outboxTable.push({ id, entity, operation, payload: JSON.parse(payloadJson) });
          return { changes: 1 };
        }
        return { changes: 0 };
      }),
      getAllAsync: vi.fn(async () => []),
      getFirstAsync: vi.fn(async (sql: string, ...params: unknown[]) => {
        if (sql.includes('FROM local_focus_sessions')) {
          const userId = params[0] as string;
          for (const s of localSessionsTable.values()) {
            if (s.user_id === userId && (s.status === 'active' || s.status === 'paused')) {
              return s;
            }
          }
        }
        return null;
      }) as unknown as SyncDb['getFirstAsync'],
    };
  });

  describe('parseFocusError', () => {
    it('correctly maps Supabase error strings to typed FocusError codes', () => {
      expect(parseFocusError(new Error('ROOM_LOCKED')).code).toBe('ROOM_LOCKED');
      expect(parseFocusError(new Error('NOT_A_MEMBER')).code).toBe('NOT_A_MEMBER');
      expect(parseFocusError(new Error('SESSION_ENDED')).code).toBe('SESSION_ENDED');
      expect(parseFocusError(new Error('RATE_LIMITED')).code).toBe('RATE_LIMITED');
      expect(parseFocusError(new Error('SESSION_ALREADY_ACTIVE')).code).toBe(
        'SESSION_ALREADY_ACTIVE',
      );
      expect(parseFocusError(new Error('Random unhandled error')).code).toBe('INVALID_ARGUMENT');
    });
  });

  describe('syncServerClock & getServerCorrectedNow', () => {
    it('computes clock offset against server_time RPC', async () => {
      const mockServerTime = new Date(Date.now() + 5000).toISOString(); // 5s in the future
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: mockServerTime, error: null }),
      } as unknown as SupabaseClient;

      const offset = await syncServerClock(mockSupabase);
      expect(offset).toBeGreaterThan(4000);
      expect(offset).toBeLessThan(6000);

      const corrected = getServerCorrectedNow();
      expect(corrected.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('startPersonalSession (offline outbox & local notification)', () => {
    it('creates local session, writes to outbox, and schedules local timer reminder', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockRejectedValue(new Error('Network error (offline)')),
      } as unknown as SupabaseClient;

      const session = await startPersonalSession(
        mockDb,
        {
          userId: 'user-1',
          mode: 'timer',
          label: 'Deep Work',
          plannedSeconds: 1500, // 25 min
        },
        mockSupabase,
      );

      expect(session.id).toBeDefined();
      expect(session.mode).toBe('timer');
      expect(session.label).toBe('Deep Work');
      expect(session.status).toBe('active');

      // Local db verified
      expect(localSessionsTable.size).toBe(1);
      const stored = localSessionsTable.get(session.id);
      expect(stored?.status).toBe('active');

      // Outbox item verified
      expect(outboxTable.length).toBe(1);
      expect(outboxTable[0]!.entity).toBe('focus_sessions');
      expect(outboxTable[0]!.operation).toBe('upsert');
    });
  });

  describe('pause, resume, and end personal session', () => {
    it('manages pause and resume states, updates paused seconds and outbox', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as unknown as SupabaseClient;

      // Start session
      const session = await startPersonalSession(
        mockDb,
        {
          userId: 'user-1',
          mode: 'stopwatch',
          label: 'Study',
        },
        mockSupabase,
      );

      // Pause session
      await pausePersonalSession(mockDb, session.id, mockSupabase);
      let stored = localSessionsTable.get(session.id);
      expect(stored?.status).toBe('paused');
      expect(stored?.last_paused_at).toBeDefined();

      // Resume session
      const pausedSession: FocusSession = {
        ...session,
        status: 'paused',
        last_paused_at: new Date(Date.now() - 60000).toISOString(), // paused 60s ago
      };
      await resumePersonalSession(mockDb, pausedSession, mockSupabase);
      stored = localSessionsTable.get(session.id);
      expect(stored?.status).toBe('active');
      expect((stored?.paused_seconds as number) >= 59).toBe(true);

      // End session
      const activeSession: FocusSession = {
        ...session,
        status: 'active',
        paused_seconds: 60,
      };
      await endPersonalSession(mockDb, session.id, activeSession, mockSupabase);
      stored = localSessionsTable.get(session.id);
      expect(stored?.status).toBe('ended');
      expect(stored?.ended_at).toBeDefined();
    });
  });

  describe('startRoomFocus error mapping', () => {
    it('throws typed FocusError when room is locked or rate limited', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'ROOM_LOCKED' } }),
      } as unknown as SupabaseClient;

      await expect(startRoomFocus('room-1', 'timer', 'Focus', 1500, mockSupabase)).rejects.toThrow(
        FocusError,
      );

      try {
        await startRoomFocus('room-1', 'timer', 'Focus', 1500, mockSupabase);
      } catch (e: unknown) {
        expect((e as FocusError).code).toBe('ROOM_LOCKED');
      }
    });
  });
});
