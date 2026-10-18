import { describe, expect, it } from 'vitest';
import type { FastingSession, FastingSettings } from './types';

/**
 * In-memory simulation of Row-Level Security policies and Room Privacy Enforcement
 * for Phase 13 Fasting tables:
 * - fasting_settings: owner-only (user_id === callerId)
 * - fasting_sessions: owner-only (user_id === callerId)
 * - get_room_snapshot: hides fasting unless member has opted in via share_fasting: true
 */
class InMemoryFastingSecurityDb {
  settings = new Map<string, FastingSettings>();
  sessions: FastingSession[] = [];
  roomMemberships = new Map<string, { room_id: string; user_id: string; privacy_settings: Record<string, unknown> }>();

  // --- fasting_settings ---
  insertOrUpdateSettings(callerId: string, item: FastingSettings): FastingSettings {
    if (callerId !== item.user_id) {
      throw new Error('RLS check violation: cannot modify fasting settings for another user');
    }
    const saved: FastingSettings = {
      ...item,
      updated_at: new Date().toISOString(),
    };
    this.settings.set(callerId, saved);
    return saved;
  }

  selectSettings(callerId: string, targetUserId: string): FastingSettings | null {
    if (callerId !== targetUserId) {
      // Base table is strictly owner-only: RLS hides other users' rows
      return null;
    }
    return this.settings.get(callerId) ?? null;
  }

  deleteSettings(callerId: string, targetUserId: string): boolean {
    if (callerId !== targetUserId) {
      throw new Error('RLS check violation: cannot delete fasting settings for another user');
    }
    return this.settings.delete(callerId);
  }

  // --- fasting_sessions ---
  insertSession(callerId: string, session: FastingSession): FastingSession {
    if (callerId !== session.user_id) {
      throw new Error('RLS check violation: cannot start fasting session for another user');
    }
    if (session.planned_minutes > 1200) {
      throw new Error('Check constraint violation: planned_minutes cannot exceed 1200');
    }

    // Check unique active session constraint
    if (session.status === 'active') {
      const existingActive = this.sessions.find(
        (s) => s.user_id === callerId && s.status === 'active',
      );
      if (existingActive) {
        throw new Error('Unique constraint violation: only one active fast allowed per user');
      }
    }

    this.sessions.push(session);
    return session;
  }

  updateSession(
    callerId: string,
    sessionId: string,
    updates: Partial<FastingSession>,
  ): FastingSession {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    if (session.user_id !== callerId) {
      throw new Error('RLS check violation: cannot edit fasting session belonging to another user');
    }
    if (updates.planned_minutes && updates.planned_minutes > 1200) {
      throw new Error('Check constraint violation: planned_minutes cannot exceed 1200');
    }

    Object.assign(session, updates, { updated_at: new Date().toISOString() });
    return session;
  }

  selectSessions(callerId: string, targetUserId: string): FastingSession[] {
    if (callerId !== targetUserId) {
      // Direct SELECT on fasting_sessions is strictly owner-only
      return [];
    }
    return this.sessions.filter((s) => s.user_id === callerId);
  }

  // --- Room Snapshot Privacy API ---
  getRoomSnapshotFastingStatus(callerId: string, memberUserId: string, todayLocalDate: string): string {
    const membershipKey = `${memberUserId}`;
    const member = this.roomMemberships.get(membershipKey);
    const privacy = member?.privacy_settings ?? {};

    // 1. If caller is looking at themselves, always return their own status
    if (callerId === memberUserId) {
      const activeSession = this.sessions.find(
        (s) => s.user_id === memberUserId && s.status === 'active',
      );
      if (activeSession) return 'fasting_now';

      const completedToday = this.sessions.find(
        (s) =>
          s.user_id === memberUserId &&
          s.status === 'completed' &&
          s.local_date === todayLocalDate,
      );
      if (completedToday) return 'completed_today';
      return 'none';
    }

    // 2. For other members: check privacy toggle share_fasting (default false)
    const shareFasting = Boolean(privacy['share_fasting']);
    if (!shareFasting) {
      return 'locked';
    }

    // When opted-in, return banded status only (never exact timestamps or plan)
    const activeSession = this.sessions.find(
      (s) => s.user_id === memberUserId && s.status === 'active',
    );
    if (activeSession) return 'fasting_now';

    const completedToday = this.sessions.find(
      (s) =>
        s.user_id === memberUserId &&
        s.status === 'completed' &&
        s.local_date === todayLocalDate,
    );
    if (completedToday) return 'completed_today';
    return 'none';
  }
}

describe('Phase 13: Fasting Tables RLS & Room Privacy Attack Tests', () => {
  const userA = 'user-a-1111-1111-1111-111111111111';
  const userB = 'user-b-2222-2222-2222-222222222222';
  const roomId = 'room-1111-1111-1111-111111111111';

  it('enforces owner-only RLS on fasting_settings: User B cannot read User A settings', () => {
    const db = new InMemoryFastingSecurityDb();

    // User A creates settings
    db.insertOrUpdateSettings(userA, {
      user_id: userA,
      enabled: true,
      protocol: '18:6',
      eating_window_start: '14:00',
      eating_window_end: '20:00',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // User A can read own settings
    expect(db.selectSettings(userA, userA)?.protocol).toBe('18:6');

    // User B querying User A settings gets null (RLS blocks access)
    expect(db.selectSettings(userB, userA)).toBeNull();
  });

  it('enforces owner-only RLS on fasting_settings: User B cannot modify or delete User A settings', () => {
    const db = new InMemoryFastingSecurityDb();

    db.insertOrUpdateSettings(userA, {
      user_id: userA,
      enabled: true,
      protocol: '16:8',
      eating_window_start: '12:00',
      eating_window_end: '20:00',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // User B attempts to overwrite User A settings
    expect(() =>
      db.insertOrUpdateSettings(userB, {
        user_id: userA,
        enabled: false,
        protocol: '12:12',
        eating_window_start: '10:00',
        eating_window_end: '22:00',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    ).toThrow('RLS check violation');

    // User B attempts to delete User A settings
    expect(() => db.deleteSettings(userB, userA)).toThrow('RLS check violation');
  });

  it('enforces owner-only RLS on fasting_sessions: User B cannot read or edit User A sessions', () => {
    const db = new InMemoryFastingSecurityDb();

    const sessionA = db.insertSession(userA, {
      id: 'sess-a-1',
      user_id: userA,
      start_at: '2026-10-18T00:00:00.000Z',
      planned_minutes: 960,
      status: 'active',
      local_date: '2026-10-18',
      created_at: '2026-10-18T00:00:00.000Z',
      updated_at: '2026-10-18T00:00:00.000Z',
    });

    // User A can select own sessions
    expect(db.selectSessions(userA, userA).length).toBe(1);

    // User B direct select returns empty
    expect(db.selectSessions(userB, userA).length).toBe(0);

    // User B cannot end or edit User A session
    expect(() =>
      db.updateSession(userB, sessionA.id, {
        status: 'ended_early',
        end_at: '2026-10-18T06:00:00.000Z',
      }),
    ).toThrow('RLS check violation');
  });

  it('enforces maximum planned fast limit (1200m) at the database layer', () => {
    const db = new InMemoryFastingSecurityDb();

    expect(() =>
      db.insertSession(userA, {
        id: 'sess-illegal',
        user_id: userA,
        start_at: '2026-10-18T00:00:00.000Z',
        planned_minutes: 1440, // 24 hours - prohibited
        status: 'active',
        local_date: '2026-10-18',
        created_at: '2026-10-18T00:00:00.000Z',
        updated_at: '2026-10-18T00:00:00.000Z',
      }),
    ).toThrow('Check constraint violation');
  });

  it('enforces unique active session constraint', () => {
    const db = new InMemoryFastingSecurityDb();

    db.insertSession(userA, {
      id: 'sess-active-1',
      user_id: userA,
      start_at: '2026-10-18T00:00:00.000Z',
      planned_minutes: 960,
      status: 'active',
      local_date: '2026-10-18',
      created_at: '2026-10-18T00:00:00.000Z',
      updated_at: '2026-10-18T00:00:00.000Z',
    });

    // Attempt to start a second active fast
    expect(() =>
      db.insertSession(userA, {
        id: 'sess-active-2',
        user_id: userA,
        start_at: '2026-10-18T02:00:00.000Z',
        planned_minutes: 960,
        status: 'active',
        local_date: '2026-10-18',
        created_at: '2026-10-18T02:00:00.000Z',
        updated_at: '2026-10-18T02:00:00.000Z',
      }),
    ).toThrow('Unique constraint violation');
  });

  it('hides fasting from rooms when share_fasting is false (PRD 6.20 FST-9)', () => {
    const db = new InMemoryFastingSecurityDb();

    // User A and B in same room, User A has share_fasting = false (default)
    db.roomMemberships.set(userA, {
      room_id: roomId,
      user_id: userA,
      privacy_settings: {
        share_fasting: false,
      },
    });

    db.insertSession(userA, {
      id: 'sess-secret',
      user_id: userA,
      start_at: '2026-10-18T00:00:00.000Z',
      planned_minutes: 960,
      status: 'active',
      local_date: '2026-10-18',
      created_at: '2026-10-18T00:00:00.000Z',
      updated_at: '2026-10-18T00:00:00.000Z',
    });

    // User B inspects room snapshot for User A -> returns "locked"
    const statusForB = db.getRoomSnapshotFastingStatus(userB, userA, '2026-10-18');
    expect(statusForB).toBe('locked');

    // User A inspecting own row in snapshot -> sees "fasting_now"
    const statusForA = db.getRoomSnapshotFastingStatus(userA, userA, '2026-10-18');
    expect(statusForA).toBe('fasting_now');
  });

  it('reveals banded status only when user opts in to share_fasting (PRD 6.20 FST-9)', () => {
    const db = new InMemoryFastingSecurityDb();

    // User A opts in to share_fasting
    db.roomMemberships.set(userA, {
      room_id: roomId,
      user_id: userA,
      privacy_settings: {
        share_fasting: true,
      },
    });

    // Active session
    db.insertSession(userA, {
      id: 'sess-opted-in',
      user_id: userA,
      start_at: '2026-10-18T00:00:00.000Z',
      planned_minutes: 960,
      status: 'active',
      local_date: '2026-10-18',
      created_at: '2026-10-18T00:00:00.000Z',
      updated_at: '2026-10-18T00:00:00.000Z',
    });

    // User B now sees banded status "fasting_now"
    const statusActive = db.getRoomSnapshotFastingStatus(userB, userA, '2026-10-18');
    expect(statusActive).toBe('fasting_now');

    // End the session as completed
    db.updateSession(userA, 'sess-opted-in', {
      status: 'completed',
      end_at: '2026-10-18T16:00:00.000Z',
    });

    // User B now sees banded status "completed_today"
    const statusCompleted = db.getRoomSnapshotFastingStatus(userB, userA, '2026-10-18');
    expect(statusCompleted).toBe('completed_today');
  });
});
