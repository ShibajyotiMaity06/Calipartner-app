import type { FocusSettings, RoomMemberWeeklyFocus } from './types';

export const AUTO_STOP_STOPWATCH_SECONDS = 12 * 3600; // 12 hours
export const STILL_FOCUSING_CHECK_SECONDS = 4 * 3600; // 4 hours
export const BREAK_SUGGESTION_SECONDS = 90 * 60; // 90 minutes
export const EXCESSIVE_DAILY_FOCUS_MINUTES = 10 * 60; // 10 hours

/**
 * Returns default user focus settings.
 */
export function getDefaultFocusSettings(userId: string): FocusSettings {
  return {
    user_id: userId,
    weekly_goal_minutes: 300, // 5 hours default
    streak_minimum_minutes: 25, // PRD FOC-11: >= 25 minutes
    break_reminders: true, // PRD FOC-12: after 90 minutes
    default_label: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Calculates net focused seconds for a personal or primary session:
 * focused time = end - start - paused
 */
export function calculateFocusedSeconds(
  startedAt: string | Date,
  endedAt: string | Date | null | undefined,
  pausedSeconds = 0,
): number {
  const startMs =
    typeof startedAt === 'string' ? new Date(startedAt).getTime() : startedAt.getTime();
  const endMs = endedAt
    ? typeof endedAt === 'string'
      ? new Date(endedAt).getTime()
      : endedAt.getTime()
    : Date.now();

  if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
    return 0;
  }

  const elapsedSeconds = Math.floor((endMs - startMs) / 1000);
  const safePaused = Math.max(0, Math.floor(pausedSeconds));
  return Math.max(0, elapsedSeconds - safePaused);
}

/**
 * Calculates net focused seconds for a participant in a room session:
 * participant time = leave or session end - join - paused
 */
export function calculateParticipantFocusedSeconds(
  joinedAt: string | Date,
  leftOrSessionEndedAt: string | Date | null | undefined,
  pausedSeconds = 0,
): number {
  return calculateFocusedSeconds(joinedAt, leftOrSessionEndedAt, pausedSeconds);
}

/**
 * Calculates remaining seconds for a timer session.
 */
export function calculateRemainingTimerSeconds(
  endsAt: string | Date,
  currentTime: string | Date = new Date(),
): number {
  const endsMs = typeof endsAt === 'string' ? new Date(endsAt).getTime() : endsAt.getTime();
  const currentMs =
    typeof currentTime === 'string' ? new Date(currentTime).getTime() : currentTime.getTime();

  if (isNaN(endsMs) || isNaN(currentMs)) {
    return 0;
  }

  return Math.max(0, Math.floor((endsMs - currentMs) / 1000));
}

/**
 * Auto-stop check for open-ended stopwatch sessions:
 * Stops automatically at 12 hours (PRD FOC-8, 7.13).
 */
export function shouldAutoStopStopwatch(
  startedAt: string | Date,
  currentTime: string | Date = new Date(),
): boolean {
  const startMs =
    typeof startedAt === 'string' ? new Date(startedAt).getTime() : startedAt.getTime();
  const currentMs =
    typeof currentTime === 'string' ? new Date(currentTime).getTime() : currentTime.getTime();
  if (isNaN(startMs) || isNaN(currentMs) || currentMs <= startMs) {
    return false;
  }
  const elapsed = Math.floor((currentMs - startMs) / 1000);
  return elapsed >= AUTO_STOP_STOPWATCH_SECONDS;
}

/**
 * "Still focusing?" check for stopwatch after 4 hours (PRD FOC-8).
 */
export function shouldPromptStillFocusing(
  startedAt: string | Date,
  currentTime: string | Date = new Date(),
): boolean {
  const startMs =
    typeof startedAt === 'string' ? new Date(startedAt).getTime() : startedAt.getTime();
  const currentMs =
    typeof currentTime === 'string' ? new Date(currentTime).getTime() : currentTime.getTime();
  if (isNaN(startMs) || isNaN(currentMs) || currentMs <= startMs) {
    return false;
  }
  const elapsed = Math.floor((currentMs - startMs) / 1000);
  return elapsed >= STILL_FOCUSING_CHECK_SECONDS;
}

/**
 * Break suggestion prompt after 90 minutes of continuous focus (PRD FOC-12).
 */
export function shouldSuggestBreak(
  continuousFocusStartedAt: string | Date,
  currentTime: string | Date = new Date(),
): boolean {
  const startMs =
    typeof continuousFocusStartedAt === 'string'
      ? new Date(continuousFocusStartedAt).getTime()
      : continuousFocusStartedAt.getTime();
  const currentMs =
    typeof currentTime === 'string' ? new Date(currentTime).getTime() : currentTime.getTime();
  if (isNaN(startMs) || isNaN(currentMs) || currentMs <= startMs) {
    return false;
  }
  const elapsed = Math.floor((currentMs - startMs) / 1000);
  return elapsed >= BREAK_SUGGESTION_SECONDS;
}

/**
 * Checks whether daily focus minutes exceed 10 hours for healthy-use check-in (PRD FOC-12).
 */
export function isExcessiveDailyFocus(dailyTotalMinutes: number): boolean {
  return dailyTotalMinutes >= EXCESSIVE_DAILY_FOCUS_MINUTES;
}

/**
 * Helper to get YYYY-MM-DD in a given IANA time zone.
 */
export function getLocalDateString(date: Date, timeZone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Finds the exact UTC millisecond where a local midnight transition occurs between start and end.
 */
function findMidnightTransition(startMs: number, endMs: number, timeZone: string): number | null {
  const startDateStr = getLocalDateString(new Date(startMs), timeZone);
  const endDateStr = getLocalDateString(new Date(endMs), timeZone);

  if (startDateStr === endDateStr) {
    return null;
  }

  // Binary search to find the exact millisecond when the date string changes
  let low = startMs;
  let high = endMs;

  while (high - low > 1000) {
    const mid = Math.floor((low + high) / 2);
    const midDateStr = getLocalDateString(new Date(mid), timeZone);
    if (midDateStr === startDateStr) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return high;
}

export interface SplitSessionDay {
  local_date: string;
  focus_seconds: number;
  focus_minutes: number;
  start_iso: string;
  end_iso: string;
}

/**
 * Splits a focus session across local midnight boundaries using the user's stored time zone.
 * Respects daylight saving time (DST) shifts and accurately assigns focus minutes to each calendar day.
 * PRD 7.13: "Sessions that cross midnight are split by day for the stats."
 */
export function splitSessionAcrossMidnight(
  session: {
    started_at: string | Date;
    ended_at: string | Date;
    paused_seconds?: number;
  },
  timeZone = 'UTC',
): SplitSessionDay[] {
  const startMs =
    typeof session.started_at === 'string'
      ? new Date(session.started_at).getTime()
      : session.started_at.getTime();
  const endMs =
    typeof session.ended_at === 'string'
      ? new Date(session.ended_at).getTime()
      : session.ended_at.getTime();

  if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
    return [];
  }

  const totalNetSeconds = calculateFocusedSeconds(
    session.started_at,
    session.ended_at,
    session.paused_seconds ?? 0,
  );
  const totalElapsedMs = endMs - startMs;

  if (totalElapsedMs <= 0 || totalNetSeconds <= 0) {
    const dateStr = getLocalDateString(new Date(startMs), timeZone);
    return [
      {
        local_date: dateStr,
        focus_seconds: 0,
        focus_minutes: 0,
        start_iso: new Date(startMs).toISOString(),
        end_iso: new Date(endMs).toISOString(),
      },
    ];
  }

  // Find all boundaries
  const segments: Array<{ startMs: number; endMs: number; local_date: string }> = [];
  let currStart = startMs;

  while (currStart < endMs) {
    const midnight = findMidnightTransition(currStart, endMs, timeZone);
    if (midnight !== null && midnight > currStart && midnight <= endMs) {
      segments.push({
        startMs: currStart,
        endMs: midnight,
        local_date: getLocalDateString(new Date(currStart), timeZone),
      });
      currStart = midnight;
    } else {
      segments.push({
        startMs: currStart,
        endMs: endMs,
        local_date: getLocalDateString(new Date(currStart), timeZone),
      });
      break;
    }
  }

  // Allocate net focused seconds proportionally to elapsed duration in each day segment
  let allocatedSeconds = 0;
  const result: SplitSessionDay[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) {
      continue;
    }
    const segElapsedMs = seg.endMs - seg.startMs;
    let segFocusedSeconds: number;

    if (i === segments.length - 1) {
      // Last segment absorbs any rounding difference to ensure sum equals totalNetSeconds
      segFocusedSeconds = Math.max(0, totalNetSeconds - allocatedSeconds);
    } else {
      const ratio = segElapsedMs / totalElapsedMs;
      segFocusedSeconds = Math.round(totalNetSeconds * ratio);
      allocatedSeconds += segFocusedSeconds;
    }

    result.push({
      local_date: seg.local_date,
      focus_seconds: segFocusedSeconds,
      focus_minutes: Math.round(segFocusedSeconds / 60),
      start_iso: new Date(seg.startMs).toISOString(),
      end_iso: new Date(seg.endMs).toISOString(),
    });
  }

  return result;
}

/**
 * Calculates focus streak from daily totals (PRD FOC-11).
 * Counts consecutive days with at least streakMinimumMinutes (default 25 minutes).
 */
export function calculateFocusStreak(
  days: Array<{ local_date: string; focus_minutes: number }>,
  streakMinimumMinutes = 25,
  todayLocalDate: string,
): { current_streak: number; longest_streak: number } {
  if (!days || days.length === 0) {
    return { current_streak: 0, longest_streak: 0 };
  }

  // Map of date string -> boolean (qualifies)
  const qualifyMap = new Map<string, boolean>();
  for (const d of days) {
    qualifyMap.set(d.local_date, d.focus_minutes >= streakMinimumMinutes);
  }

  // Helper to step date backward
  function prevDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  const yesterday = prevDate(todayLocalDate);

  // Determine current streak
  let currentStreak = 0;
  const todayQualifies = qualifyMap.get(todayLocalDate) === true;
  const yesterdayQualifies = qualifyMap.get(yesterday) === true;

  if (todayQualifies) {
    currentStreak = 1;
    let check = prevDate(todayLocalDate);
    while (qualifyMap.get(check) === true) {
      currentStreak++;
      check = prevDate(check);
    }
  } else if (yesterdayQualifies) {
    currentStreak = 1;
    let check = prevDate(yesterday);
    while (qualifyMap.get(check) === true) {
      currentStreak++;
      check = prevDate(check);
    }
  }

  // Determine longest streak across all days
  const sortedDates = Array.from(qualifyMap.keys()).sort();
  let longestStreak = 0;
  let run = 0;

  for (let i = 0; i < sortedDates.length; i++) {
    const date = sortedDates[i];
    if (!date) {
      continue;
    }
    if (qualifyMap.get(date) === true) {
      if (run === 0) {
        run = 1;
      } else {
        const expectedPrev = prevDate(date);
        const prev = sortedDates[i - 1];
        if (prev && prev === expectedPrev && qualifyMap.get(expectedPrev)) {
          run++;
        } else {
          run = 1;
        }
      }
      if (run > longestStreak) {
        longestStreak = run;
      }
    } else {
      run = 0;
    }
  }

  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  return {
    current_streak: currentStreak,
    longest_streak: longestStreak,
  };
}

/**
 * Calculates weekly focus stats against a weekly goal (PRD FOC-10).
 */
export function calculateWeeklyFocusStats(
  days: Array<{ local_date: string; focus_minutes: number }>,
  weeklyGoalMinutes: number,
): {
  total_minutes: number;
  daily_average_minutes: number;
  goal_completion_percent: number;
  remaining_minutes: number;
} {
  const totalMinutes = days.reduce((acc, d) => acc + (d.focus_minutes || 0), 0);
  const dayCount = Math.max(1, days.length);
  const dailyAverage = Math.round((totalMinutes / dayCount) * 10) / 10;
  const goal = Math.max(1, weeklyGoalMinutes);
  const percent = Math.min(100, Math.round((totalMinutes / goal) * 100));
  const remaining = Math.max(0, weeklyGoalMinutes - totalMinutes);

  return {
    total_minutes: totalMinutes,
    daily_average_minutes: dailyAverage,
    goal_completion_percent: percent,
    remaining_minutes: remaining,
  };
}

/**
 * Neutral ordering of room focus members:
 * PRD FOC-10, RPG-8: "neutrally sorted (me first, then alphabetical), with no ranking."
 */
export function sortRoomFocusMembers(
  members: RoomMemberWeeklyFocus[],
  myUserId: string,
): RoomMemberWeeklyFocus[] {
  return [...members].sort((a, b) => {
    if (a.user_id === myUserId) return -1;
    if (b.user_id === myUserId) return 1;
    const nameA = a.nickname || a.username || '';
    const nameB = b.nickname || b.username || '';
    return nameA.localeCompare(nameB);
  });
}
