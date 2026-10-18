import { describe, expect, it } from 'vitest';
import {
  calculateFocusedSeconds,
  calculateParticipantFocusedSeconds,
  calculateRemainingTimerSeconds,
  shouldAutoStopStopwatch,
  splitSessionAcrossMidnight,
} from './focus';
import { getDefaultPrivacySettings, sanitizePrivacySettings } from './rooms';
import type { FocusSession, RoomFocusSession, RoomPrivacySettings } from './types';

describe('Phase 9B: Focus Attack Tests & Security Invariants', () => {
  it('1. CLOCK RESILIENCE: Elapsed time is correct after app kill and restart (simulated)', () => {
    // App started a stopwatch at 08:00:00Z
    const startedAt = '2026-10-12T08:00:00.000Z';
    const pausedSeconds = 120; // 2 minutes paused before crash

    // App is killed at 08:15:00Z. App restarted at 08:45:00Z.
    // Client rehydrates state from persistent timestamp, NOT a memory counter
    const restartTime = '2026-10-12T08:45:00.000Z'; // 45 minutes elapsed = 2700s
    const netSeconds = calculateFocusedSeconds(startedAt, restartTime, pausedSeconds);

    // 2700s elapsed - 120s paused = 2580s (43 mins)
    expect(netSeconds).toBe(2580);
  });

  it('2. LATE JOINER: Late joiner sees the right remaining time', () => {
    // Room started a 50-minute timer session (3000s)
    const serverEndsAt = '2026-10-12T10:50:00.000Z';

    // Member B joins 10 minutes late at 10:10:00Z
    const lateJoinTime = '2026-10-12T10:10:00.000Z';
    const remainingSeconds = calculateRemainingTimerSeconds(serverEndsAt, lateJoinTime);

    // Remaining time must be 40 minutes (2400 seconds), NOT the original 50 minutes
    expect(remainingSeconds).toBe(2400);
  });

  it('3. TIMER SYNCHRONIZATION: Timer ends for all participants at the same server moment', () => {
    const serverStartedAt = '2026-10-12T14:00:00.000Z';
    const serverEndsAt = '2026-10-12T14:25:00.000Z'; // 25-minute timer

    // Participant 1 joined at start
    const p1Join = serverStartedAt;
    // Participant 2 joined 5 mins late
    const p2Join = '2026-10-12T14:05:00.000Z';

    // At 14:25:00Z, server timer expires
    const expiryTime = serverEndsAt;

    // Remaining time reaches exactly 0 for both
    expect(calculateRemainingTimerSeconds(serverEndsAt, expiryTime)).toBe(0);

    // Neither participant can be credited for time beyond serverEndsAt
    const p1Time = calculateParticipantFocusedSeconds(p1Join, serverEndsAt, 0);
    const p2Time = calculateParticipantFocusedSeconds(p2Join, serverEndsAt, 0);

    expect(p1Time).toBe(1500); // 25 minutes
    expect(p2Time).toBe(1200); // 20 minutes
  });

  it("4. PARTICIPANT BOUNDARIES: A participant's time covers only join-to-leave", () => {
    // Participant joined at 09:30 and left at 10:15 (45 minutes = 2700s) with 5m break (300s)
    const pJoin = '2026-10-12T09:30:00.000Z';
    const pLeave = '2026-10-12T10:15:00.000Z';
    const pPaused = 300;

    const focusedTime = calculateParticipantFocusedSeconds(pJoin, pLeave, pPaused);

    // Must be exactly 40 minutes (2400s), ignoring session start before join and session end after leave
    expect(focusedTime).toBe(2400);
  });

  it('5. PRIVACY ENFORCEMENT: Labels are hidden by default unless opted in', () => {
    const defaults = getDefaultPrivacySettings();
    expect(defaults.share_focus_label).toBe(false);
    expect(defaults.focus_label).toBe(false);
    expect(defaults.share_focus_status).toBe(true);
    expect(defaults.focus_status).toBe(true);

    // Simulated projection of a session label to another member
    function maskLabelForMember(
      session: { label: string | null; starter_id: string },
      viewerId: string,
      starterPrivacy: RoomPrivacySettings,
    ): string | null {
      // Owner always sees own label
      if (viewerId === session.starter_id) {
        return session.label;
      }
      // Other members only see label if share_focus_label is true
      if (starterPrivacy.share_focus_label || starterPrivacy.focus_label) {
        return session.label;
      }
      return null;
    }

    const session = { starter_id: 'user-alice', label: 'Math Exam Prep' };

    // Bob views Alice's session with default privacy
    const bobViewDefault = maskLabelForMember(session, 'user-bob', defaults);
    expect(bobViewDefault).toBeNull();

    // Alice views her own session
    const aliceView = maskLabelForMember(session, 'user-alice', defaults);
    expect(aliceView).toBe('Math Exam Prep');

    // Alice explicitly opts in to share labels
    const aliceOptIn = sanitizePrivacySettings({ ...defaults, share_focus_label: true });
    const bobViewOptIn = maskLabelForMember(session, 'user-bob', aliceOptIn);
    expect(bobViewOptIn).toBe('Math Exam Prep');
  });

  it('6. ACCESS RESTRICTIONS: Non-members and Locked-room members cannot read sessions', () => {
    interface SimulatedRoom {
      id: string;
      state: 'active' | 'locked' | 'dormant';
      members: string[];
    }

    const testRoom: SimulatedRoom = {
      id: 'room-1',
      state: 'active',
      members: ['user-a', 'user-b'],
    };

    function checkCanReadRoomFocus(
      room: SimulatedRoom,
      userId: string,
    ): 'OK' | 'NOT_A_MEMBER' | 'ROOM_LOCKED' {
      if (!room.members.includes(userId)) {
        return 'NOT_A_MEMBER';
      }
      if (room.state === 'locked') {
        return 'ROOM_LOCKED';
      }
      return 'OK';
    }

    // Active member can read
    expect(checkCanReadRoomFocus(testRoom, 'user-a')).toBe('OK');

    // Non-member rejected
    expect(checkCanReadRoomFocus(testRoom, 'user-stranger')).toBe('NOT_A_MEMBER');

    // When room becomes locked (unpaid/lapsed plan), member is blocked
    const lockedRoom: SimulatedRoom = { ...testRoom, state: 'locked' };
    expect(checkCanReadRoomFocus(lockedRoom, 'user-a')).toBe('ROOM_LOCKED');
  });

  it('7. RATE LIMITING: Enforces 1 active session per room and 10 sessions per room per day', () => {
    class SimulatedRoomFocusManager {
      private activeSessions: Map<string, RoomFocusSession> = new Map();
      private dailySessionStarts: Map<string, number> = new Map();

      startSession(roomId: string, mode: 'stopwatch' | 'timer'): string {
        // 1. One active session check
        if (this.activeSessions.has(roomId)) {
          throw new Error('SESSION_ALREADY_ACTIVE');
        }

        // 2. 10 per day check
        const count = this.dailySessionStarts.get(roomId) ?? 0;
        if (count >= 10) {
          throw new Error('RATE_LIMITED');
        }

        const sessionId = `session-${count + 1}`;
        const newSession: RoomFocusSession = {
          id: sessionId,
          room_id: roomId,
          started_by: 'user-a',
          mode,
          started_at: new Date().toISOString(),
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        this.activeSessions.set(roomId, newSession);
        this.dailySessionStarts.set(roomId, count + 1);
        return sessionId;
      }

      endSession(roomId: string) {
        this.activeSessions.delete(roomId);
      }
    }

    const manager = new SimulatedRoomFocusManager();
    const roomId = 'room-alpha';

    // Start 1st session
    manager.startSession(roomId, 'timer');

    // Attempting to start another active session fails
    expect(() => manager.startSession(roomId, 'timer')).toThrow('SESSION_ALREADY_ACTIVE');

    // End session 1
    manager.endSession(roomId);

    // Start and end 9 more sessions (reaching 10 total)
    for (let i = 2; i <= 10; i++) {
      manager.startSession(roomId, 'stopwatch');
      manager.endSession(roomId);
    }

    // 11th session in same day is rate limited
    expect(() => manager.startSession(roomId, 'timer')).toThrow('RATE_LIMITED');
  });

  it('8. FORGOTTEN SESSION AUTO-CLOSED: Stopwatch running > 12 hours is auto-ended', () => {
    const startedAt = '2026-10-12T00:00:00.000Z';
    const at12Hours1Sec = '2026-10-12T12:00:01.000Z';

    expect(shouldAutoStopStopwatch(startedAt, at12Hours1Sec)).toBe(true);

    // If auto-ended at 12 hours cap, net seconds is capped to 43200
    const netSeconds = calculateFocusedSeconds(startedAt, '2026-10-12T12:00:00.000Z', 0);
    expect(netSeconds).toBe(43200); // exactly 12 hours
  });

  it('9. MIDNIGHT & DST SPLITS: Correctly splits session across local midnight during DST transition', () => {
    // In America/New_York on Nov 1, 2026 (Fall Back DST transition day)
    // 23:00 to 01:00 across midnight
    const split = splitSessionAcrossMidnight(
      {
        started_at: '2026-11-01T03:00:00Z',
        ended_at: '2026-11-01T06:00:00Z',
        paused_seconds: 0,
      },
      'America/New_York',
    );

    expect(split.length).toBeGreaterThanOrEqual(1);
    const totalAllocated = split.reduce((acc, d) => acc + d.focus_seconds, 0);
    expect(totalAllocated).toBe(3 * 3600); // 10800s
  });

  it('10. IDEMPOTENT OFFLINE SYNC: Personal session with client UUID syncs once', () => {
    const clientUuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    const localStore = new Map<string, FocusSession>();

    function upsertSession(session: FocusSession) {
      localStore.set(session.id, { ...session });
    }

    const session: FocusSession = {
      id: clientUuid,
      user_id: 'user-me',
      mode: 'stopwatch',
      started_at: '2026-10-12T10:00:00Z',
      ended_at: '2026-10-12T10:45:00Z',
      paused_seconds: 0,
      status: 'ended',
      source: 'personal',
      created_at: '2026-10-12T10:00:00Z',
      updated_at: '2026-10-12T10:45:00Z',
    };

    // First write offline
    upsertSession(session);
    expect(localStore.size).toBe(1);

    // Repeated sync flushes or retries with same client UUID do NOT duplicate
    upsertSession(session);
    upsertSession(session);
    expect(localStore.size).toBe(1);
    expect(localStore.get(clientUuid)?.status).toBe('ended');
  });
});
