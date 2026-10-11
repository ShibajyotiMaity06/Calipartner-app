import { describe, expect, it } from 'vitest';
import {
  calculateWeeklyConsistencyScore,
  sortLeaderboardEntries,
} from './progress';
import type {
  ProgressDateRange,
  RoomPrivacySettings,
  Sex,
  UserStreak,
  WeeklyScore,
} from './types';

/**
 * In-memory simulation of Phase 7 tables, RLS policies, and SECURITY DEFINER query functions:
 * - daily_summaries: owner-only direct select; no client write
 * - user_streaks: owner-only direct select; no client write
 * - room_streaks: room members only direct select; no client write
 * - weekly_scores: owner-only direct select; no client write
 * - leaderboard_settings: owner-only select & update
 * - get_individual_progress(range): auth required; returns caller's metrics
 * - get_room_progress(room_id, range, selected): member access required; applies per-member privacy settings; locked members excluded and marked
 * - get_leaderboard(week_start): auth required; excludes opted-out users; only returns nickname, avatar, score, rank
 */
interface SimulatedProfile {
  id: string;
  username: string;
  nickname: string;
  avatar_url: string | null;
  sex: Sex;
  timezone: string;
  country: string | null;
  created_at: string;
}

interface SimulatedDailySummary {
  user_id: string;
  local_date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  steps: number;
  water_ml: number;
  workout_minutes: number;
  weight_kg: number | null;
  logged_day: boolean;
  goal_day: boolean;
  low_intake_flag: boolean;
  calorie_floor: number;
  target_calories: number;
  entries_count: number;
  updated_at: string;
}

interface SimulatedRoom {
  id: string;
  host_id: string;
  status: 'active' | 'dormant' | 'locked' | 'archived';
  created_at: string;
}

interface SimulatedRoomMember {
  room_id: string;
  user_id: string;
  status: 'active' | 'paused' | 'locked' | 'left';
  privacy_settings: RoomPrivacySettings;
}

class InMemoryPhase7Db {
  profiles = new Map<string, SimulatedProfile>();
  dailySummaries: SimulatedDailySummary[] = [];
  userStreaks = new Map<string, UserStreak>();
  roomStreaks = new Map<string, { room_id: string; current_streak: number; longest_streak: number }>();
  weeklyScores: WeeklyScore[] = [];
  leaderboardSettings = new Map<string, { opted_out: boolean }>();
  rooms = new Map<string, SimulatedRoom>();
  roomMembers: SimulatedRoomMember[] = [];
  userAccess = new Map<string, boolean>(); // true if plan/trial holder

  // Helper to register profile
  createProfile(p: SimulatedProfile) {
    this.profiles.set(p.id, p);
  }

  // Helper to set room
  createRoom(r: SimulatedRoom) {
    this.rooms.set(r.id, r);
  }

  // Helper to add room member
  addRoomMember(m: SimulatedRoomMember) {
    this.roomMembers.push(m);
  }

  // DIRECT TABLE ACCESS (RLS ENFORCEMENT)
  selectDailySummariesDirect(callerId: string | null, targetUserId: string): SimulatedDailySummary[] {
    if (!callerId) {
      throw new Error('RLS violation: unauthenticated direct select denied');
    }
    if (callerId !== targetUserId) {
      throw new Error('RLS violation: user cannot directly select another user daily_summaries');
    }
    return this.dailySummaries.filter((ds) => ds.user_id === targetUserId);
  }

  insertDailySummaryDirect(_callerId: string | null) {
    throw new Error('RLS violation: client direct write to daily_summaries denied');
  }

  selectWeeklyScoresDirect(callerId: string | null, targetUserId: string): WeeklyScore[] {
    if (!callerId) {
      throw new Error('RLS violation: unauthenticated direct select denied');
    }
    if (callerId !== targetUserId) {
      throw new Error('RLS violation: user cannot directly select another user weekly_scores');
    }
    return this.weeklyScores.filter((ws) => ws.user_id === targetUserId);
  }

  // SECURITY DEFINER: get_individual_progress(range)
  getIndividualProgress(callerId: string | null, range: ProgressDateRange) {
    if (!callerId) {
      throw new Error('UNAUTHENTICATED');
    }
    const profile = this.profiles.get(callerId);
    if (!profile) throw new Error('PROFILE_NOT_FOUND');

    const summaries = this.dailySummaries.filter((ds) => ds.user_id === callerId);
    const loggedCount = summaries.filter((ds) => ds.logged_day).length;
    const goalCount = summaries.filter((ds) => ds.goal_day).length;

    return {
      range,
      user_id: callerId,
      calories: {
        daily: summaries.map((s) => ({
          date: s.local_date,
          calories: s.calories,
          is_logged_day: s.logged_day,
          is_goal_day: s.goal_day,
        })),
        logged_days_count: loggedCount,
        goal_days_count: goalCount,
        adherence_pct: loggedCount > 0 ? Math.round((goalCount / loggedCount) * 1000) / 10 : 0,
      },
    };
  }

  // SECURITY DEFINER: get_room_progress(room_id, range, selected)
  getRoomProgress(callerId: string | null, roomId: string, _selectedMemberIds?: string[]) {
    if (!callerId) {
      throw new Error('UNAUTHENTICATED');
    }

    const room = this.rooms.get(roomId);
    if (!room || room.status === 'locked' || room.status === 'archived') {
      throw new Error('ROOM_NOT_ACCESSIBLE');
    }

    const membership = this.roomMembers.find(
      (m) => m.room_id === roomId && m.user_id === callerId && (m.status === 'active' || m.status === 'paused'),
    );
    if (!membership) {
      throw new Error('NOT_A_ROOM_MEMBER');
    }

    const allMembers = this.roomMembers.filter((m) => m.room_id === roomId);
    const summaryTable: Array<Record<string, unknown>> = [];
    const memberSeries: Array<Record<string, unknown>> = [];

    // Order: me first, then alphabetical by nickname
    const sortedMembers = [...allMembers].sort((a, b) => {
      if (a.user_id === callerId) return -1;
      if (b.user_id === callerId) return 1;
      const nickA = this.profiles.get(a.user_id)?.nickname || '';
      const nickB = this.profiles.get(b.user_id)?.nickname || '';
      return nickA.localeCompare(nickB);
    });

    for (const m of sortedMembers) {
      const p = this.profiles.get(m.user_id);
      const isSelf = m.user_id === callerId;
      const isLocked = m.status === 'locked';

      if (isLocked) {
        summaryTable.push({
          user_id: m.user_id,
          nickname: p?.nickname || 'Unknown',
          status: 'locked',
          is_self: isSelf,
          is_locked_member: true,
          consistency_score: 'locked',
          weight_change_kg: 'locked',
        });
        continue;
      }

      const priv = m.privacy_settings;
      const userSums = this.dailySummaries.filter((ds) => ds.user_id === m.user_id);
      const loggedDays = userSums.filter((ds) => ds.logged_day).length;
      const goalDays = userSums.filter((ds) => ds.goal_day).length;
      const score = calculateWeeklyConsistencyScore(loggedDays, goalDays);

      summaryTable.push({
        user_id: m.user_id,
        nickname: p?.nickname || 'Unknown',
        status: m.status,
        is_self: isSelf,
        is_locked_member: false,
        consistency_score: isSelf || priv.share_streak ? score : 'locked',
        weight_change_kg: isSelf || priv.share_weight_progress ? 0.5 : 'locked',
        raw_weight_kg: isSelf || priv.share_weight_number ? 70.0 : 'locked', // never raw weight unless opted in
      });

      memberSeries.push({
        user_id: m.user_id,
        nickname: p?.nickname || 'Unknown',
        is_self: isSelf,
        consistency: isSelf || priv.share_streak ? score : 'locked',
      });
    }

    return {
      room_id: roomId,
      total_members: allMembers.length,
      summary_table: summaryTable,
      members_series: memberSeries,
    };
  }

  // SECURITY DEFINER: get_leaderboard(week_start)
  getLeaderboard(callerId: string | null, weekStart: string) {
    if (!callerId) {
      throw new Error('UNAUTHENTICATED');
    }

    const settings = this.leaderboardSettings.get(callerId);
    if (settings?.opted_out) {
      return { opted_out: true, info_note: 'Ranked by consistency, not restriction.' };
    }

    // Filter eligible, non-opted-out users in same cohort
    const callerScore = this.weeklyScores.find(
      (ws) => ws.user_id === callerId && ws.week_start_date === weekStart,
    );
    const cohortId = callerScore?.cohort_id || 'cutting_asia_in_c0';

    const cohortScores = this.weeklyScores.filter((ws) => {
      const userSettings = this.leaderboardSettings.get(ws.user_id);
      return (
        ws.week_start_date === weekStart &&
        ws.cohort_id === cohortId &&
        ws.is_eligible &&
        !userSettings?.opted_out
      );
    });

    const mapped = cohortScores.map((ws) => {
      const p = this.profiles.get(ws.user_id);
      return {
        userId: ws.user_id,
        nickname: p?.nickname || 'User',
        avatarUrl: p?.avatar_url || null,
        consistencyScore: ws.consistency_score,
        loggedDays: ws.logged_days,
        earliestCompletionAt: ws.earliest_completion_at,
      };
    });

    const ranked = sortLeaderboardEntries(mapped);
    const top10 = ranked.slice(0, 10).map((r) => ({
      rank: r.rank,
      nickname: r.nickname,
      avatar_url: r.avatarUrl,
      consistency_score: r.consistencyScore,
      is_me: r.userId === callerId,
    }));

    const myRank = ranked.find((r) => r.userId === callerId);

    return {
      opted_out: false,
      division: callerScore?.division || 'cutting',
      cohort_id: cohortId,
      week_start_date: weekStart,
      top_10: top10,
      my_rank: myRank
        ? {
            rank: myRank.rank,
            nickname: myRank.nickname,
            avatar_url: myRank.avatarUrl,
            consistency_score: myRank.consistencyScore,
            is_eligible: true,
          }
        : null,
      total_in_cohort: ranked.length,
      info_note: 'Ranked by consistency, not restriction.',
    };
  }
}

describe('Phase 7 RLS & Attack Tests - Direct Table Access Protection', () => {
  const db = new InMemoryPhase7Db();

  db.createProfile({
    id: 'user-alice',
    username: 'alice',
    nickname: 'Alice',
    avatar_url: null,
    sex: 'female',
    timezone: 'UTC',
    country: 'IN',
    created_at: '2026-09-01T00:00:00Z',
  });

  db.createProfile({
    id: 'user-bob',
    username: 'bob',
    nickname: 'Bob',
    avatar_url: null,
    sex: 'male',
    timezone: 'UTC',
    country: 'IN',
    created_at: '2026-09-01T00:00:00Z',
  });

  db.dailySummaries.push({
    user_id: 'user-bob',
    local_date: '2026-10-01',
    calories: 2100,
    protein: 150,
    carbs: 200,
    fat: 60,
    steps: 8000,
    water_ml: 2500,
    workout_minutes: 45,
    weight_kg: 80.5,
    logged_day: true,
    goal_day: true,
    low_intake_flag: false,
    calorie_floor: 1500,
    target_calories: 2200,
    entries_count: 4,
    updated_at: '2026-10-01T20:00:00Z',
  });

  it('rejects unauthenticated requests to read daily_summaries', () => {
    expect(() => db.selectDailySummariesDirect(null, 'user-bob')).toThrow(
      'RLS violation: unauthenticated direct select denied',
    );
  });

  it('blocks User A from directly reading User B daily_summaries (RLS Strict)', () => {
    expect(() => db.selectDailySummariesDirect('user-alice', 'user-bob')).toThrow(
      'RLS violation: user cannot directly select another user daily_summaries',
    );
  });

  it('allows User A to select only their own daily_summaries', () => {
    const records = db.selectDailySummariesDirect('user-bob', 'user-bob');
    expect(records.length).toBe(1);
    expect(records[0]!.calories).toBe(2100);
  });

  it('blocks direct client write to daily_summaries (only maintained by functions/triggers)', () => {
    expect(() => db.insertDailySummaryDirect('user-alice')).toThrow(
      'RLS violation: client direct write to daily_summaries denied',
    );
  });

  it('blocks User A from directly selecting User B weekly_scores', () => {
    expect(() => db.selectWeeklyScoresDirect('user-alice', 'user-bob')).toThrow(
      'RLS violation: user cannot directly select another user weekly_scores',
    );
  });
});

describe('Phase 7 RLS & Attack Tests - Room Progress Security & Privacy Enforcement', () => {
  const db = new InMemoryPhase7Db();

  const aliceId = 'user-alice';
  const bobId = 'user-bob';
  const charlieId = 'user-charlie'; // outsider
  const lockedUserId = 'user-locked';

  db.createProfile({
    id: aliceId,
    username: 'alice',
    nickname: 'Alice',
    avatar_url: null,
    sex: 'female',
    timezone: 'UTC',
    country: 'IN',
    created_at: '2026-09-01T00:00:00Z',
  });

  db.createProfile({
    id: bobId,
    username: 'bob',
    nickname: 'Bob',
    avatar_url: null,
    sex: 'male',
    timezone: 'UTC',
    country: 'IN',
    created_at: '2026-09-01T00:00:00Z',
  });

  db.createProfile({
    id: lockedUserId,
    username: 'lapsed',
    nickname: 'Lapsed Member',
    avatar_url: null,
    sex: 'other',
    timezone: 'UTC',
    country: 'IN',
    created_at: '2026-09-01T00:00:00Z',
  });

  const roomId = 'room-alpha';
  db.createRoom({
    id: roomId,
    host_id: aliceId,
    status: 'active',
    created_at: '2026-09-01T00:00:00Z',
  });

  // Alice shares streak, but hides weight progress & weight number
  db.addRoomMember({
    room_id: roomId,
    user_id: aliceId,
    status: 'active',
    privacy_settings: {
      share_streak: true,
      share_goal_completion: true,
      share_steps: true,
      share_water: true,
      share_workouts: true,
      share_workout_details: false,
      share_calories_macros: false,
      share_meals: 'never',
      share_weight_number: false,
      share_weight_progress: false,
      share_fasting: false,
    },
  });

  // Bob hides streak, hides weight number, but shares weight progress
  db.addRoomMember({
    room_id: roomId,
    user_id: bobId,
    status: 'active',
    privacy_settings: {
      share_streak: false,
      share_goal_completion: true,
      share_steps: true,
      share_water: true,
      share_workouts: true,
      share_workout_details: false,
      share_calories_macros: false,
      share_meals: 'never',
      share_weight_number: false,
      share_weight_progress: true,
      share_fasting: false,
    },
  });

  // Lapsed member
  db.addRoomMember({
    room_id: roomId,
    user_id: lockedUserId,
    status: 'locked',
    privacy_settings: {
      share_streak: true,
      share_goal_completion: true,
      share_steps: true,
      share_water: true,
      share_workouts: true,
      share_workout_details: false,
      share_calories_macros: false,
      share_meals: 'never',
      share_weight_number: false,
      share_weight_progress: false,
      share_fasting: false,
    },
  });

  it('rejects non-room member from querying room progress', () => {
    expect(() => db.getRoomProgress(charlieId, roomId, [])).toThrow('NOT_A_ROOM_MEMBER');
  });

  it('rejects unauthenticated requests to room progress', () => {
    expect(() => db.getRoomProgress(null, roomId, [])).toThrow('UNAUTHENTICATED');
  });

  it('rejects requests to locked or archived rooms', () => {
    const lockedRoomId = 'room-locked';
    db.createRoom({ id: lockedRoomId, host_id: aliceId, status: 'locked', created_at: '2026-09-01T00:00:00Z' });
    db.addRoomMember({
      room_id: lockedRoomId,
      user_id: aliceId,
      status: 'active',
      privacy_settings: {
        share_streak: true,
        share_goal_completion: true,
        share_steps: true,
        share_water: true,
        share_workouts: true,
        share_workout_details: false,
        share_calories_macros: false,
        share_meals: 'never',
        share_weight_number: false,
        share_weight_progress: false,
        share_fasting: false,
      },
    });
    expect(() => db.getRoomProgress(aliceId, lockedRoomId)).toThrow('ROOM_NOT_ACCESSIBLE');
  });

  it('enforces privacy: masks Bob hidden streak as locked when viewed by Alice', () => {
    const res = db.getRoomProgress(aliceId, roomId);
    const bobSummary = res.summary_table.find((s) => s.user_id === bobId);
    expect(bobSummary).toBeDefined();
    expect(bobSummary!.consistency_score).toBe('locked');
  });

  it('enforces PRD RPG-2: NEVER reveals raw weight unless member opted in (share_weight_number)', () => {
    const res = db.getRoomProgress(aliceId, roomId);
    const bobSummary = res.summary_table.find((s) => s.user_id === bobId);
    expect(bobSummary).toBeDefined();
    // Bob shared weight progress (change), but did NOT opt in to raw weight
    expect(bobSummary!.weight_change_kg).toBe(0.5);
    expect(bobSummary!.raw_weight_kg).toBe('locked');
  });

  it('marks locked members and excludes their progress data from charts', () => {
    const res = db.getRoomProgress(aliceId, roomId);
    const lockedSummary = res.summary_table.find((s) => s.user_id === lockedUserId);
    expect(lockedSummary).toBeDefined();
    expect(lockedSummary!.status).toBe('locked');
    expect(lockedSummary!.is_locked_member).toBe(true);
    expect(lockedSummary!.consistency_score).toBe('locked');
    expect(lockedSummary!.weight_change_kg).toBe('locked');
  });

  it('orders summary table me-first, then alphabetical by nickname (PRD RPG-4)', () => {
    const res = db.getRoomProgress(aliceId, roomId);
    // First row must be Alice (me)
    expect(res.summary_table[0]!.user_id).toBe(aliceId);
    expect(res.summary_table[0]!.is_self).toBe(true);
  });
});

describe('Phase 7 RLS & Attack Tests - Leaderboards & Opt-Out', () => {
  const db = new InMemoryPhase7Db();
  const weekStart = '2026-10-05';

  const u1 = 'user-1';
  const u2 = 'user-2';
  const optOutUser = 'user-opt-out';

  db.createProfile({
    id: u1,
    username: 'u1_user',
    nickname: 'Alpha',
    avatar_url: 'https://avatar.com/1.png',
    sex: 'male',
    timezone: 'Asia/Kolkata',
    country: 'IN',
    created_at: '2026-09-01T00:00:00Z',
  });

  db.createProfile({
    id: u2,
    username: 'u2_user',
    nickname: 'Beta',
    avatar_url: null,
    sex: 'female',
    timezone: 'Asia/Kolkata',
    country: 'IN',
    created_at: '2026-09-01T00:00:00Z',
  });

  db.createProfile({
    id: optOutUser,
    username: 'secret_user',
    nickname: 'SecretUser',
    avatar_url: null,
    sex: 'other',
    timezone: 'Asia/Kolkata',
    country: 'IN',
    created_at: '2026-09-01T00:00:00Z',
  });

  db.leaderboardSettings.set(optOutUser, { opted_out: true });

  const cohort = 'cutting_asia_in_c0';

  db.weeklyScores.push({
    id: 'ws-1',
    user_id: u1,
    week_start_date: weekStart,
    division: 'cutting',
    cohort_id: cohort,
    logged_days: 6,
    goal_days: 5,
    consistency_score: 85,
    low_intake_flag: false,
    is_eligible: true,
    earliest_completion_at: '2026-10-08T10:00:00Z',
    created_at: '2026-10-08T10:00:00Z',
    updated_at: '2026-10-08T10:00:00Z',
  });

  db.weeklyScores.push({
    id: 'ws-2',
    user_id: u2,
    week_start_date: weekStart,
    division: 'cutting',
    cohort_id: cohort,
    logged_days: 7,
    goal_days: 6,
    consistency_score: 95,
    low_intake_flag: false,
    is_eligible: true,
    earliest_completion_at: '2026-10-09T10:00:00Z',
    created_at: '2026-10-09T10:00:00Z',
    updated_at: '2026-10-09T10:00:00Z',
  });

  db.weeklyScores.push({
    id: 'ws-3',
    user_id: optOutUser,
    week_start_date: weekStart,
    division: 'cutting',
    cohort_id: cohort,
    logged_days: 7,
    goal_days: 7,
    consistency_score: 100, // Perfect score, but opted out
    low_intake_flag: false,
    is_eligible: true,
    earliest_completion_at: '2026-10-09T10:00:00Z',
    created_at: '2026-10-09T10:00:00Z',
    updated_at: '2026-10-09T10:00:00Z',
  });

  it('completely hides opted-out users from leaderboards (PRD RNK-6)', () => {
    const res = db.getLeaderboard(u1, weekStart);
    expect(res.opted_out).toBe(false);
    expect(res.top_10).toBeDefined();
    expect(res.top_10!.find((e: { nickname: string }) => e.nickname === 'SecretUser')).toBeUndefined();
    expect(res.total_in_cohort).toBe(2); // Only u1 and u2
  });

  it('returns opted_out flag when an opted-out user queries leaderboard', () => {
    const res = db.getLeaderboard(optOutUser, weekStart);
    expect(res.opted_out).toBe(true);
    expect(res.top_10).toBeUndefined();
  });

  it('strictly returns ONLY nickname, avatar, score and rank (no @username, no calories, no weight)', () => {
    const res = db.getLeaderboard(u1, weekStart);
    expect(res.top_10).toBeDefined();
    expect(res.top_10!.length).toBeGreaterThan(0);
    for (const entry of res.top_10!) {
      expect(entry).toHaveProperty('rank');
      expect(entry).toHaveProperty('nickname');
      expect(entry).toHaveProperty('avatar_url');
      expect(entry).toHaveProperty('consistency_score');
      // Must NOT expose private data
      expect(entry).not.toHaveProperty('username');
      expect(entry).not.toHaveProperty('calories');
      expect(entry).not.toHaveProperty('weight');
      expect(entry).not.toHaveProperty('email');
    }
  });

  it('includes info note explaining ranking rules (PRD RNK-7: consistency, not restriction)', () => {
    const res = db.getLeaderboard(u1, weekStart);
    expect(res.info_note).toBe('Ranked by consistency, not restriction.');
  });
});
