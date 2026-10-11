import { describe, expect, it } from 'vitest';
import {
  assignCohortId,
  calculatePersonalStreak,
  calculateRoomStreak,
  calculateWeeklyConsistencyScore,
  determineLeaderboardDivision,
  evaluateGoalDay,
  evaluateLoggedDay,
  evaluateLowIntakeRule,
  getCalorieFloorForSex,
  isLeaderboardEligible,
  isRoomDayAchieved,
  sortLeaderboardEntries,
} from './progress';
import type { DayIntakeRecord, LeaderboardUserEntry } from './progress';

describe('Phase 7 Core - Logged Day (PRD 7.3)', () => {
  const targetKcal = 2000;

  it('requires at least 2 food entries', () => {
    // 1 entry with 100% calories is NOT a logged day (stops 1 snack from counting)
    expect(evaluateLoggedDay(1, 2000, targetKcal)).toBe(false);
    expect(evaluateLoggedDay(0, 0, targetKcal)).toBe(false);
  });

  it('requires calories logged to be at least 50% of the daily target', () => {
    // 2 entries with 999 kcal (49.95%) -> false
    expect(evaluateLoggedDay(2, 999, targetKcal)).toBe(false);
    // 2 entries with exactly 1000 kcal (50%) -> true
    expect(evaluateLoggedDay(2, 1000, targetKcal)).toBe(true);
    // 3 entries with 1500 kcal (75%) -> true
    expect(evaluateLoggedDay(3, 1500, targetKcal)).toBe(true);
  });

  it('handles invalid or zero targets safely', () => {
    expect(evaluateLoggedDay(2, 1000, 0)).toBe(false);
    expect(evaluateLoggedDay(2, 1000, -100)).toBe(false);
    expect(evaluateLoggedDay(2, -500, 2000)).toBe(false);
  });
});

describe('Phase 7 Core - Goal Day Ranges (PRD 7.3)', () => {
  const targetKcal = 2000;

  it('rejects unlogged days regardless of calories', () => {
    expect(evaluateGoalDay(false, 'maintain', 2000, targetKcal)).toBe(false);
    expect(evaluateGoalDay(false, 'cut', 1900, targetKcal)).toBe(false);
    expect(evaluateGoalDay(false, 'bulk', 2100, targetKcal)).toBe(false);
  });

  it('evaluates Cutting goal range: 85% to 105%', () => {
    // target 2000: range is 1700 to 2100
    expect(evaluateGoalDay(true, 'cut', 1699, targetKcal)).toBe(false); // below lower bound: undereating not rewarded
    expect(evaluateGoalDay(true, 'cut', 1700, targetKcal)).toBe(true);
    expect(evaluateGoalDay(true, 'cut', 1900, targetKcal)).toBe(true);
    expect(evaluateGoalDay(true, 'cut', 2100, targetKcal)).toBe(true);
    expect(evaluateGoalDay(true, 'cut', 2101, targetKcal)).toBe(false); // overshooting
  });

  it('evaluates Bulking goal range: 95% to 115%', () => {
    // target 2000: range is 1900 to 2300
    expect(evaluateGoalDay(true, 'bulk', 1899, targetKcal)).toBe(false);
    expect(evaluateGoalDay(true, 'bulk', 1900, targetKcal)).toBe(true);
    expect(evaluateGoalDay(true, 'bulk', 2100, targetKcal)).toBe(true);
    expect(evaluateGoalDay(true, 'bulk', 2300, targetKcal)).toBe(true);
    expect(evaluateGoalDay(true, 'bulk', 2301, targetKcal)).toBe(false);
  });

  it('evaluates Maintain goal range: 90% to 110%', () => {
    // target 2000: range is 1800 to 2200
    expect(evaluateGoalDay(true, 'maintain', 1799, targetKcal)).toBe(false);
    expect(evaluateGoalDay(true, 'maintain', 1800, targetKcal)).toBe(true);
    expect(evaluateGoalDay(true, 'maintain', 2000, targetKcal)).toBe(true);
    expect(evaluateGoalDay(true, 'maintain', 2200, targetKcal)).toBe(true);
    expect(evaluateGoalDay(true, 'maintain', 2201, targetKcal)).toBe(false);
  });
});

describe('Phase 7 Core - Weekly Consistency Score (PRD 7.3)', () => {
  it('calculates 100 for 7 logged days and 7 goal days', () => {
    expect(calculateWeeklyConsistencyScore(7, 7)).toBe(100);
  });

  it('calculates 0 for 0 logged days and 0 goal days', () => {
    expect(calculateWeeklyConsistencyScore(0, 0)).toBe(0);
  });

  it('weighs logged days at 40% and goal days at 60%', () => {
    // 7 logged, 0 goal: 100 * (0.4 * 7/7 + 0.6 * 0/7) = 40
    expect(calculateWeeklyConsistencyScore(7, 0)).toBe(40);
    // 0 logged, 7 goal: 100 * (0.4 * 0 + 0.6 * 1) = 60
    expect(calculateWeeklyConsistencyScore(0, 7)).toBe(60);
    // 5 logged, 3 goal: 100 * (0.4 * 5/7 + 0.6 * 3/7) = 100 * (2.0/7 + 1.8/7) = 100 * 3.8 / 7 = 54.285... -> 54.3
    expect(calculateWeeklyConsistencyScore(5, 3)).toBe(54.3);
  });

  it('caps score at 100', () => {
    expect(calculateWeeklyConsistencyScore(8, 8)).toBe(100);
  });
});

describe('Phase 7 Core - Calorie Floors & Low-Intake Rule (PRD 7.2, 7.3)', () => {
  it('returns correct calorie floor per sex', () => {
    expect(getCalorieFloorForSex('female')).toBe(1200);
    expect(getCalorieFloorForSex('male')).toBe(1500);
    expect(getCalorieFloorForSex('other')).toBe(1350);
  });

  it('raises check-in flag and voids goal days when below floor on >= 5 of 7 days', () => {
    const maleFloor = 1500;
    const days: DayIntakeRecord[] = [
      { date: '2026-10-01', calories: 1200, isLoggedDay: true, isGoalDay: true },
      { date: '2026-10-02', calories: 1300, isLoggedDay: true, isGoalDay: true },
      { date: '2026-10-03', calories: 1400, isLoggedDay: true, isGoalDay: true },
      { date: '2026-10-04', calories: 1250, isLoggedDay: true, isGoalDay: true },
      { date: '2026-10-05', calories: 1350, isLoggedDay: true, isGoalDay: true }, // 5th day below floor
      { date: '2026-10-06', calories: 1800, isLoggedDay: true, isGoalDay: true },
      { date: '2026-10-07', calories: 1900, isLoggedDay: true, isGoalDay: true },
    ];

    const result = evaluateLowIntakeRule(days, maleFloor);
    expect(result.isLowIntakeFlagRaised).toBe(true);
    expect(result.daysBelowFloorCount).toBe(5);

    // Days 1-5 had calories < 1500 -> adjusted to isGoalDay = false
    expect(result.adjustedDays[0]!.isGoalDay).toBe(false);
    expect(result.adjustedDays[1]!.isGoalDay).toBe(false);
    expect(result.adjustedDays[2]!.isGoalDay).toBe(false);
    expect(result.adjustedDays[3]!.isGoalDay).toBe(false);
    expect(result.adjustedDays[4]!.isGoalDay).toBe(false);

    // Days 6-7 had calories >= 1500 -> kept isGoalDay = true
    expect(result.adjustedDays[5]!.isGoalDay).toBe(true);
    expect(result.adjustedDays[6]!.isGoalDay).toBe(true);
  });

  it('does NOT raise flag when below floor on fewer than 5 days', () => {
    const maleFloor = 1500;
    const days: DayIntakeRecord[] = [
      { date: '2026-10-01', calories: 1200, isLoggedDay: true, isGoalDay: true },
      { date: '2026-10-02', calories: 1300, isLoggedDay: true, isGoalDay: true },
      { date: '2026-10-03', calories: 1400, isLoggedDay: true, isGoalDay: true },
      { date: '2026-10-04', calories: 1250, isLoggedDay: true, isGoalDay: true }, // 4 days below
      { date: '2026-10-05', calories: 1800, isLoggedDay: true, isGoalDay: true },
      { date: '2026-10-06', calories: 1850, isLoggedDay: true, isGoalDay: true },
      { date: '2026-10-07', calories: 1900, isLoggedDay: true, isGoalDay: true },
    ];

    const result = evaluateLowIntakeRule(days, maleFloor);
    expect(result.isLowIntakeFlagRaised).toBe(false);
    expect(result.daysBelowFloorCount).toBe(4);
    // All original goal days kept intact
    expect(result.adjustedDays[0]!.isGoalDay).toBe(true);
  });
});

describe('Phase 7 Core - Personal Streak (PRD 6.14 STR-1, 7.4)', () => {
  it('computes current streak ending today', () => {
    const dailyLogs = [
      { date: '2026-10-01', loggedDay: true },
      { date: '2026-10-02', loggedDay: true },
      { date: '2026-10-03', loggedDay: true },
      { date: '2026-10-04', loggedDay: true },
    ];
    const { currentStreak, longestStreak } = calculatePersonalStreak(
      dailyLogs,
      '2026-10-04',
    );
    expect(currentStreak).toBe(4);
    expect(longestStreak).toBe(4);
  });

  it('keeps streak alive when yesterday was logged and today is still pending', () => {
    const dailyLogs = [
      { date: '2026-10-01', loggedDay: true },
      { date: '2026-10-02', loggedDay: true },
      { date: '2026-10-03', loggedDay: true },
      { date: '2026-10-04', loggedDay: false }, // today not logged yet
    ];
    const { currentStreak, longestStreak } = calculatePersonalStreak(
      dailyLogs,
      '2026-10-04',
    );
    expect(currentStreak).toBe(3); // from yesterday
    expect(longestStreak).toBe(3);
  });

  it('resets streak to 0 if yesterday was missed and today is not logged', () => {
    const dailyLogs = [
      { date: '2026-10-01', loggedDay: true },
      { date: '2026-10-02', loggedDay: false }, // missed
      { date: '2026-10-03', loggedDay: false }, // today
    ];
    const { currentStreak, longestStreak } = calculatePersonalStreak(
      dailyLogs,
      '2026-10-03',
    );
    expect(currentStreak).toBe(0);
    expect(longestStreak).toBe(1);
  });

  it('tracks longest streak historically', () => {
    const dailyLogs = [
      { date: '2026-09-01', loggedDay: true },
      { date: '2026-09-02', loggedDay: true },
      { date: '2026-09-03', loggedDay: true },
      { date: '2026-09-04', loggedDay: true },
      { date: '2026-09-05', loggedDay: true }, // 5-day streak
      { date: '2026-09-06', loggedDay: false }, // break
      { date: '2026-09-07', loggedDay: true },
      { date: '2026-09-08', loggedDay: true }, // current 2-day streak
    ];
    const { currentStreak, longestStreak } = calculatePersonalStreak(
      dailyLogs,
      '2026-09-08',
    );
    expect(currentStreak).toBe(2);
    expect(longestStreak).toBe(5);
  });
});

describe('Phase 7 Core - Room Streak (PRD 6.14 STR-2, 7.4)', () => {
  it('requires 100% of active members for rooms of <= 5 people', () => {
    // 2-person room
    expect(isRoomDayAchieved(2, 2)).toBe(true);
    expect(isRoomDayAchieved(2, 1)).toBe(false);

    // 5-person room
    expect(isRoomDayAchieved(5, 5)).toBe(true);
    expect(isRoomDayAchieved(5, 4)).toBe(false);
  });

  it('requires at least 60% rounded up for rooms > 5 people', () => {
    // 6 people: ceil(0.6 * 6) = ceil(3.6) = 4
    expect(isRoomDayAchieved(6, 3)).toBe(false);
    expect(isRoomDayAchieved(6, 4)).toBe(true);
    expect(isRoomDayAchieved(6, 5)).toBe(true);

    // 7 people: ceil(0.6 * 7) = ceil(4.2) = 5
    expect(isRoomDayAchieved(7, 4)).toBe(false);
    expect(isRoomDayAchieved(7, 5)).toBe(true);

    // 10 people: ceil(0.6 * 10) = 6
    expect(isRoomDayAchieved(10, 5)).toBe(false);
    expect(isRoomDayAchieved(10, 6)).toBe(true);

    // 20 people: ceil(0.6 * 20) = 12
    expect(isRoomDayAchieved(20, 11)).toBe(false);
    expect(isRoomDayAchieved(20, 12)).toBe(true);
  });

  it('calculates room streak across consecutive dates', () => {
    const records = [
      { date: '2026-10-01', activeMemberCount: 3, loggedMemberCount: 3 },
      { date: '2026-10-02', activeMemberCount: 3, loggedMemberCount: 3 },
      { date: '2026-10-03', activeMemberCount: 3, loggedMemberCount: 3 },
    ];
    const { currentStreak, longestStreak } = calculateRoomStreak(
      records,
      '2026-10-03',
    );
    expect(currentStreak).toBe(3);
    expect(longestStreak).toBe(3);
  });
});

describe('Phase 7 Core - Leaderboards (PRD 6.16, 7.5)', () => {
  it('places users in Beginner division during their first 28 days', () => {
    const created = '2026-10-01T00:00:00Z';
    // 10 days later -> Beginner
    expect(determineLeaderboardDivision('cut', created, '2026-10-11T00:00:00Z')).toBe('beginner');
    // Exactly 28 days later -> Beginner
    expect(determineLeaderboardDivision('bulk', created, '2026-10-29T00:00:00Z')).toBe('beginner');
    // 29 days later -> division follows goal
    expect(determineLeaderboardDivision('cut', created, '2026-10-30T00:00:00Z')).toBe('cutting');
    expect(determineLeaderboardDivision('bulk', created, '2026-10-30T00:00:00Z')).toBe('bulking');
    expect(determineLeaderboardDivision('maintain', created, '2026-10-30T00:00:00Z')).toBe('maintain');
  });

  it('determines leaderboard eligibility', () => {
    // Needs room access, >= 3 logged days, not opted out
    expect(isLeaderboardEligible({ hasRoomAccess: true, loggedDaysCount: 3 })).toBe(true);
    expect(isLeaderboardEligible({ hasRoomAccess: true, loggedDaysCount: 2 })).toBe(false); // < 3 days
    expect(isLeaderboardEligible({ hasRoomAccess: false, loggedDaysCount: 5 })).toBe(false); // no room access
    expect(isLeaderboardEligible({ hasRoomAccess: true, loggedDaysCount: 7, isOptedOut: true })).toBe(false); // opted out
  });

  it('generates deterministic cohort IDs', () => {
    const c1 = assignCohortId('cutting', 'Asia/Kolkata', 'IN', 15);
    const c2 = assignCohortId('cutting', 'Asia/Kolkata', 'IN', 99);
    const c3 = assignCohortId('cutting', 'Asia/Kolkata', 'IN', 105);

    expect(c1).toBe('cutting_asia_in_c0');
    expect(c2).toBe('cutting_asia_in_c0');
    expect(c3).toBe('cutting_asia_in_c1'); // next bucket of 100
  });

  it('breaks ties: Consistency Score DESC, Logged Days DESC, Earliest Completion ASC', () => {
    const entries: LeaderboardUserEntry[] = [
      {
        userId: 'u1',
        nickname: 'Alice',
        avatarUrl: null,
        consistencyScore: 85,
        loggedDays: 6,
        earliestCompletionAt: '2026-10-06T12:00:00Z',
      },
      {
        userId: 'u2',
        nickname: 'Bob',
        avatarUrl: null,
        consistencyScore: 90, // Higher score wins
        loggedDays: 5,
        earliestCompletionAt: '2026-10-07T12:00:00Z',
      },
      {
        userId: 'u3',
        nickname: 'Charlie',
        avatarUrl: null,
        consistencyScore: 85, // Same score as Alice, but 7 logged days beats 6
        loggedDays: 7,
        earliestCompletionAt: '2026-10-06T15:00:00Z',
      },
      {
        userId: 'u4',
        nickname: 'David',
        avatarUrl: null,
        consistencyScore: 85, // Same score and logged days as Alice, but earlier completion wins
        loggedDays: 6,
        earliestCompletionAt: '2026-10-06T10:00:00Z',
      },
    ];

    const ranked = sortLeaderboardEntries(entries);
    expect(ranked[0]!.userId).toBe('u2'); // 90 score -> rank 1
    expect(ranked[1]!.userId).toBe('u3'); // 85 score, 7 logged days -> rank 2
    expect(ranked[2]!.userId).toBe('u4'); // 85 score, 6 logged days, 10:00 completion -> rank 3
    expect(ranked[3]!.userId).toBe('u1'); // 85 score, 6 logged days, 12:00 completion -> rank 4

    expect(ranked[0]!.rank).toBe(1);
    expect(ranked[1]!.rank).toBe(2);
    expect(ranked[2]!.rank).toBe(3);
    expect(ranked[3]!.rank).toBe(4);
  });
});
