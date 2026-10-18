import type { Goal, Sex } from './types';

export type LeaderboardDivision = 'beginner' | 'cutting' | 'bulking' | 'maintain';

export interface LoggedDayEvaluationInput {
  entryCount: number;
  calories: number;
  targetKcal: number;
}

export interface GoalDayEvaluationInput {
  isLoggedDay: boolean;
  goal: Goal;
  calories: number;
  targetKcal: number;
}

export interface DayIntakeRecord {
  date: string; // YYYY-MM-DD
  calories: number;
  isLoggedDay: boolean;
  isGoalDay: boolean;
}

export interface LowIntakeRuleResult {
  isLowIntakeFlagRaised: boolean;
  daysBelowFloorCount: number;
  adjustedDays: DayIntakeRecord[];
}

export interface PersonalStreakDay {
  date: string; // YYYY-MM-DD
  loggedDay: boolean;
}

export interface RoomStreakDay {
  date: string; // YYYY-MM-DD
  activeMemberCount: number;
  loggedMemberCount: number;
}

export interface LeaderboardUserEntry {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  consistencyScore: number;
  loggedDays: number;
  earliestCompletionAt: string | null; // ISO UTC
}

export interface LeaderboardRankedEntry extends LeaderboardUserEntry {
  rank: number;
}

/**
 * Calorie floors per sex (PRD 7.2):
 * - female: 1,200 kcal
 * - male: 1,500 kcal
 * - other / prefer not to say: 1,350 kcal
 */
export function getCalorieFloorForSex(sex: Sex | 'other'): number {
  if (sex === 'male') return 1500;
  if (sex === 'female') return 1200;
  return 1350;
}

/**
 * 1. Logged Day (PRD 7.3):
 * Requires at least 2 food entries (in any of the 5 sections)
 * AND calories logged of at least 50% of the day's target.
 */
export function evaluateLoggedDay(
  entryCount: number,
  calories: number,
  targetKcal: number,
): boolean {
  if (entryCount < 2) return false;
  if (targetKcal <= 0 || !Number.isFinite(targetKcal)) return false;
  if (calories <= 0 || !Number.isFinite(calories)) return false;
  return calories >= 0.5 * targetKcal;
}

/**
 * 2. Goal Day (PRD 7.3):
 * A goal day is a logged day where calories fall inside the goal range:
 * - Cutting: 85% to 105%
 * - Bulking: 95% to 115%
 * - Maintain: 90% to 110%
 *
 * Eating below the lower bound does NOT count as a goal day (undereating never raises score).
 * Overshooting also does not count.
 */
export function evaluateGoalDay(
  isLoggedDay: boolean,
  goal: Goal,
  calories: number,
  targetKcal: number,
): boolean {
  if (!isLoggedDay) return false;
  if (targetKcal <= 0 || !Number.isFinite(targetKcal)) return false;
  if (calories <= 0 || !Number.isFinite(calories)) return false;

  const ratio = calories / targetKcal;

  if (goal === 'cut') {
    return ratio >= 0.85 && ratio <= 1.05;
  }
  if (goal === 'bulk') {
    return ratio >= 0.95 && ratio <= 1.15;
  }
  // maintain
  return ratio >= 0.9 && ratio <= 1.1;
}

/**
 * 3. Weekly Consistency Score (PRD 7.3):
 * Weekly Consistency Score = 100 x ( 0.4 x logged days / 7 + 0.6 x goal days / 7 )
 * Capped at 100, minimum 0.
 * Rounded to 1 decimal place.
 */
export function calculateWeeklyConsistencyScore(
  loggedDaysCount: number,
  goalDaysCount: number,
): number {
  const safeLogged = Math.max(0, Math.min(7, loggedDaysCount));
  const safeGoal = Math.max(0, Math.min(7, goalDaysCount));

  const raw = 100 * (0.4 * (safeLogged / 7) + 0.6 * (safeGoal / 7));
  const capped = Math.min(100, Math.max(0, raw));
  return Math.round(capped * 10) / 10;
}

/**
 * 4. Low-Intake Rule (PRD 7.2, 7.3, Phase 7 prompt):
 * If calories are below the calorie floor on 5 of 7 days:
 * - Those days (days below floor) are NOT goal days
 * - A check-in flag is raised (isLowIntakeFlagRaised = true).
 */
export function evaluateLowIntakeRule(
  days: DayIntakeRecord[],
  calorieFloor: number,
): LowIntakeRuleResult {
  if (!days || days.length === 0) {
    return {
      isLowIntakeFlagRaised: false,
      daysBelowFloorCount: 0,
      adjustedDays: [],
    };
  }

  const daysBelowFloor = days.filter((d) => d.calories < calorieFloor);
  const countBelowFloor = daysBelowFloor.length;
  const isFlagRaised = countBelowFloor >= 5;

  const adjustedDays: DayIntakeRecord[] = days.map((d) => {
    if (isFlagRaised && d.calories < calorieFloor) {
      return {
        ...d,
        isGoalDay: false,
      };
    }
    return { ...d };
  });

  return {
    isLowIntakeFlagRaised: isFlagRaised,
    daysBelowFloorCount: countBelowFloor,
    adjustedDays,
  };
}

/**
 * Helper to get previous date YYYY-MM-DD.
 */
export function getPreviousDateString(dateStr: string, daysBack = 1): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().split('T')[0]!;
}

/**
 * Helper to compute difference in days between two YYYY-MM-DD strings (a - b).
 */
export function getDaysDiff(dateStrA: string, dateStrB: string): number {
  const tA = new Date(dateStrA + 'T00:00:00Z').getTime();
  const tB = new Date(dateStrB + 'T00:00:00Z').getTime();
  return Math.round((tA - tB) / (1000 * 60 * 60 * 24));
}

/**
 * 5. Personal Streak (PRD 6.14 STR-1, 7.4):
 * Consecutive logged days evaluated in user's local time zone.
 * - Today logged -> streak ends today.
 * - Today not logged yet -> if yesterday logged, streak is still alive from yesterday.
 * - Neither today nor yesterday logged -> current streak is 0.
 * Longest streak counts the maximum consecutive run across all provided records.
 */
export function calculatePersonalStreak(
  dailyLogs: PersonalStreakDay[],
  todayLocalDate: string,
): { currentStreak: number; longestStreak: number } {
  if (!dailyLogs || dailyLogs.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Map of date -> loggedDay
  const loggedMap = new Map<string, boolean>();
  for (const entry of dailyLogs) {
    loggedMap.set(entry.date, entry.loggedDay);
  }

  // 1. Current streak calculation:
  // Check if today is logged
  const todayLogged = loggedMap.get(todayLocalDate) === true;
  const yesterdayDate = getPreviousDateString(todayLocalDate, 1);
  const yesterdayLogged = loggedMap.get(yesterdayDate) === true;

  let currentStreak = 0;

  if (todayLogged) {
    currentStreak = 1;
    let checkDate = getPreviousDateString(todayLocalDate, 1);
    while (loggedMap.get(checkDate) === true) {
      currentStreak++;
      checkDate = getPreviousDateString(checkDate, 1);
    }
  } else if (yesterdayLogged) {
    // Today not logged yet, but yesterday was logged: streak is active
    currentStreak = 1;
    let checkDate = getPreviousDateString(yesterdayDate, 1);
    while (loggedMap.get(checkDate) === true) {
      currentStreak++;
      checkDate = getPreviousDateString(checkDate, 1);
    }
  } else {
    currentStreak = 0;
  }

  // 2. Longest streak calculation across sorted days
  const sortedDates = Array.from(loggedMap.keys()).sort();
  let longestStreak = 0;
  let runningStreak = 0;
  let lastLoggedDate: string | null = null;

  for (const date of sortedDates) {
    const isLogged = loggedMap.get(date) === true;
    if (isLogged) {
      if (lastLoggedDate !== null && getDaysDiff(date, lastLoggedDate) === 1) {
        runningStreak++;
      } else {
        runningStreak = 1;
      }
      lastLoggedDate = date;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    } else {
      runningStreak = 0;
      lastLoggedDate = null;
    }
  }

  // Ensure longest streak is at least current streak
  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  return { currentStreak, longestStreak };
}

/**
 * 6. Room Streak (PRD 6.14 STR-2, 7.4):
 * Consecutive days on which:
 * - In rooms of up to 5 people: EVERY active, non-paused member had a logged day.
 * - In larger rooms (> 5 people): at least 60% of active, non-paused members (rounded up) had a logged day.
 */
export function isRoomDayAchieved(activeMemberCount: number, loggedMemberCount: number): boolean {
  if (activeMemberCount <= 0) return false;
  if (loggedMemberCount <= 0) return false;

  if (activeMemberCount <= 5) {
    return loggedMemberCount >= activeMemberCount;
  }

  // Larger rooms (> 5 people): at least 60%, rounded up
  const threshold = Math.ceil(0.6 * activeMemberCount);
  return loggedMemberCount >= threshold;
}

export function calculateRoomStreak(
  roomDailyRecords: RoomStreakDay[],
  todayLocalDate: string,
): { currentStreak: number; longestStreak: number } {
  if (!roomDailyRecords || roomDailyRecords.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const achievedMap = new Map<string, boolean>();
  for (const rec of roomDailyRecords) {
    const achieved = isRoomDayAchieved(rec.activeMemberCount, rec.loggedMemberCount);
    achievedMap.set(rec.date, achieved);
  }

  const todayAchieved = achievedMap.get(todayLocalDate) === true;
  const yesterdayDate = getPreviousDateString(todayLocalDate, 1);
  const yesterdayAchieved = achievedMap.get(yesterdayDate) === true;

  let currentStreak = 0;

  if (todayAchieved) {
    currentStreak = 1;
    let checkDate = getPreviousDateString(todayLocalDate, 1);
    while (achievedMap.get(checkDate) === true) {
      currentStreak++;
      checkDate = getPreviousDateString(checkDate, 1);
    }
  } else if (yesterdayAchieved) {
    currentStreak = 1;
    let checkDate = getPreviousDateString(yesterdayDate, 1);
    while (achievedMap.get(checkDate) === true) {
      currentStreak++;
      checkDate = getPreviousDateString(checkDate, 1);
    }
  } else {
    currentStreak = 0;
  }

  // Longest streak
  const sortedDates = Array.from(achievedMap.keys()).sort();
  let longestStreak = 0;
  let runningStreak = 0;
  let lastAchievedDate: string | null = null;

  for (const date of sortedDates) {
    const isAchieved = achievedMap.get(date) === true;
    if (isAchieved) {
      if (lastAchievedDate !== null && getDaysDiff(date, lastAchievedDate) === 1) {
        runningStreak++;
      } else {
        runningStreak = 1;
      }
      lastAchievedDate = date;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    } else {
      runningStreak = 0;
      lastAchievedDate = null;
    }
  }

  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  return { currentStreak, longestStreak };
}

/**
 * 7. Leaderboard Division (PRD 6.16 RNK-2, 7.5):
 * - Beginner: first 28 days from profile creation.
 * - Otherwise determined by goal: Cutting, Bulking, Maintain.
 */
export function determineLeaderboardDivision(
  goal: Goal,
  accountCreatedAt: string | Date,
  asOfDate: string | Date = new Date(),
): LeaderboardDivision {
  const created =
    typeof accountCreatedAt === 'string' ? new Date(accountCreatedAt) : accountCreatedAt;
  const asOf = typeof asOfDate === 'string' ? new Date(asOfDate) : asOfDate;

  const diffMs = asOf.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays >= 0 && diffDays <= 28) {
    return 'beginner';
  }

  if (goal === 'cut') return 'cutting';
  if (goal === 'bulk') return 'bulking';
  return 'maintain';
}

/**
 * 8. Leaderboard Eligibility (PRD 6.16, 7.5):
 * - Member of an unlocked room OR plan/trial holder
 * - AND logged on at least 3 days in the week
 * - AND not opted out.
 */
export function isLeaderboardEligible(input: {
  hasRoomAccess: boolean;
  loggedDaysCount: number;
  isOptedOut?: boolean;
}): boolean {
  if (input.isOptedOut) return false;
  if (!input.hasRoomAccess) return false;
  return input.loggedDaysCount >= 3;
}

/**
 * 9. Deterministic Cohort Assignment (PRD 6.16 RNK-3):
 * Users placed into cohorts of ~100 matched by division, timezone region / country.
 */
export function assignCohortId(
  division: LeaderboardDivision,
  timezone: string,
  country: string | null,
  userIndex: number,
): string {
  // Extract region from timezone (e.g. 'Asia/Kolkata' -> 'Asia', 'America/New_York' -> 'America')
  const tzRegion = timezone.split('/')[0]?.toLowerCase() || 'global';
  const ctry = (country || 'xx').toLowerCase();
  const bucket = Math.floor(userIndex / 100);
  return `${division}_${tzRegion}_${ctry}_c${bucket}`;
}

/**
 * 10. Leaderboard Tie-Breakers (PRD 6.16 RNK-5):
 * Ties are broken by:
 * 1. Consistency score (descending)
 * 2. Logged days in week (descending)
 * 3. Earliest completion timestamp (ascending, earliest first)
 * 4. Deterministic fallback by user ID (ascending)
 */
export function sortLeaderboardEntries(entries: LeaderboardUserEntry[]): LeaderboardRankedEntry[] {
  const sorted = [...entries].sort((a, b) => {
    // 1. Consistency score DESC
    if (b.consistencyScore !== a.consistencyScore) {
      return b.consistencyScore - a.consistencyScore;
    }
    // 2. Logged days DESC
    if (b.loggedDays !== a.loggedDays) {
      return b.loggedDays - a.loggedDays;
    }
    // 3. Earliest completion ASC
    if (a.earliestCompletionAt && b.earliestCompletionAt) {
      const timeDiff =
        new Date(a.earliestCompletionAt).getTime() - new Date(b.earliestCompletionAt).getTime();
      if (timeDiff !== 0) return timeDiff;
    } else if (a.earliestCompletionAt && !b.earliestCompletionAt) {
      return -1;
    } else if (!a.earliestCompletionAt && b.earliestCompletionAt) {
      return 1;
    }
    // 4. Fallback: user ID ASC
    return a.userId.localeCompare(b.userId);
  });

  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}
