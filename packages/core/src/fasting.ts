import { getLocalDateString } from './localDay';
import { addDaysToDateString } from './trackers';
import type {
  FastingComputedState,
  FastingGatingResult,
  FastingProtocol,
  FastingProtocolConfig,
  FastingSession,
  FastingSettings,
  FastingStats,
  FastingStreak,
  HealthScreening,
  IndividualFastingDailyHours,
  IndividualFastingProgress,
  LocalReminderSchedule,
  ScheduledWindowModeState,
} from './types';
import { isQuietHours } from './notifications';

// -----------------------------------------------------------------------------
// Constants (PRD 6.20 FST-2, FST-11, 7.9, 8.1)
// -----------------------------------------------------------------------------

export const MAX_PLANNED_FASTING_MINUTES = 1200; // 20 hours max planned fast
export const MIN_PLANNED_FASTING_MINUTES = 60; // 1 hour minimum
export const CHECK_IN_PAST_PLAN_MINUTES = 120; // 2 hours past planned duration
export const CHECK_IN_MAX_HOURS_MINUTES = 1200; // 20 hours safety check-in mark
export const STRONG_END_FAST_MINUTES = 1440; // 24 hours strong end-fast prompt

export const FASTING_PROTOCOLS: Record<FastingProtocol, FastingProtocolConfig> = {
  '12:12': {
    protocol: '12:12',
    label: '12:12 Balanced',
    fastingHours: 12,
    eatingHours: 12,
    plannedMinutes: 720,
    description: '12 hours fasting, 12 hours eating. A gentle daily rhythm.',
  },
  '14:10': {
    protocol: '14:10',
    label: '14:10 Moderate',
    fastingHours: 14,
    eatingHours: 10,
    plannedMinutes: 840,
    description: '14 hours fasting, 10 hours eating. Sustainable everyday window.',
  },
  '16:8': {
    protocol: '16:8',
    label: '16:8 Popular',
    fastingHours: 16,
    eatingHours: 8,
    plannedMinutes: 960,
    description: '16 hours fasting, 8 hours eating. The most popular protocol.',
  },
  '18:6': {
    protocol: '18:6',
    label: '18:6 Advanced',
    fastingHours: 18,
    eatingHours: 6,
    plannedMinutes: 1080,
    description: '18 hours fasting, 6 hours eating. Narrower eating window.',
  },
  '20:4': {
    protocol: '20:4',
    label: '20:4 Max Launch',
    fastingHours: 20,
    eatingHours: 4,
    plannedMinutes: 1200,
    description: '20 hours fasting, 4 hours eating. CaliPartner maximum planned window.',
  },
  custom: {
    protocol: 'custom',
    label: 'Custom Window',
    fastingHours: 16,
    eatingHours: 8,
    plannedMinutes: 960,
    description: 'Custom daily eating window up to 20 hours of fasting.',
  },
};

export const DEFAULT_FASTING_SETTINGS: Omit<FastingSettings, 'user_id'> = {
  enabled: false,
  protocol: '16:8',
  eating_window_start: '12:00',
  eating_window_end: '20:00',
  custom_fasting_hours: 16,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

/**
 * Validates planned duration against PRD rules:
 * - Minimum: 60 minutes (1 hour)
 * - Maximum planned: 1,200 minutes (20 hours)
 * - Prohibited: OMAD (e.g. 23:1), multi-day fasts (>= 24 hours planned)
 */
export function validatePlannedMinutes(minutes: number): { valid: boolean; error?: string } {
  if (!Number.isFinite(minutes) || minutes < MIN_PLANNED_FASTING_MINUTES) {
    return {
      valid: false,
      error: `Planned duration must be at least ${MIN_PLANNED_FASTING_MINUTES / 60} hour (${MIN_PLANNED_FASTING_MINUTES} minutes).`,
    };
  }

  if (minutes > MAX_PLANNED_FASTING_MINUTES) {
    return {
      valid: false,
      error: `Maximum planned fast duration is 20 hours (${MAX_PLANNED_FASTING_MINUTES} minutes). OMAD and multi-day fasts are not permitted.`,
    };
  }

  return { valid: true };
}

/**
 * Returns planned minutes for a given protocol and optional custom hours.
 */
export function getProtocolPlannedMinutes(
  protocol: FastingProtocol,
  customHours?: number | null,
): number {
  if (protocol === 'custom') {
    const hours = customHours ?? 16;
    const clampedHours = Math.max(1, Math.min(20, hours));
    return clampedHours * 60;
  }
  return FASTING_PROTOCOLS[protocol]?.plannedMinutes ?? 960;
}

// -----------------------------------------------------------------------------
// Fast State Computation from Timestamps (PRD 6.20 FST-3, FST-12, 7.9)
// -----------------------------------------------------------------------------

/**
 * Computes fast progress, elapsed/remaining time, and safety prompts directly from
 * stored UTC timestamps and the current clock.
 * Clock-based, never counter-based; survives app kill and restart.
 */
export function computeFastingState(
  session: FastingSession | null,
  referenceNow?: string | Date,
): FastingComputedState {
  if (!session) {
    return {
      session: null,
      isActive: false,
      elapsedMinutes: 0,
      remainingMinutes: 0,
      progressPercentage: 0,
      isPastPlanned: false,
      isCompleted: false,
      checkInPrompt: false,
      strongEndFastPrompt: false,
    };
  }

  const startMs = new Date(session.start_at).getTime();
  const plannedMinutes = Math.max(1, session.planned_minutes);

  // If the session has already ended (completed or ended early)
  if (session.end_at) {
    const endMs = new Date(session.end_at).getTime();
    const elapsedMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));
    const isCompleted = session.status === 'completed' || elapsedMinutes >= plannedMinutes;
    const progressPercentage = Math.min(100, Math.round((elapsedMinutes / plannedMinutes) * 100));

    return {
      session,
      isActive: false,
      elapsedMinutes,
      remainingMinutes: 0,
      progressPercentage,
      isPastPlanned: elapsedMinutes >= plannedMinutes,
      isCompleted,
      checkInPrompt: false,
      strongEndFastPrompt: false,
    };
  }

  // Active session computed against reference now
  const nowMs = referenceNow ? new Date(referenceNow).getTime() : Date.now();
  const elapsedMinutes = Math.max(0, Math.round((nowMs - startMs) / 60000));
  const remainingMinutes = Math.max(0, plannedMinutes - elapsedMinutes);
  const progressPercentage = Math.min(100, Math.round((elapsedMinutes / plannedMinutes) * 100));
  const isPastPlanned = elapsedMinutes >= plannedMinutes;

  // Safety checks (PRD 6.20 FST-11, 7.9):
  // 1. Strong prompt to end at 24 hours (1440 min)
  // 2. Check-in prompt if fast runs 2 hours past planned duration OR past 20 hours (1200 min)
  const strongEndFastPrompt = elapsedMinutes >= STRONG_END_FAST_MINUTES;
  const checkInPrompt =
    strongEndFastPrompt ||
    elapsedMinutes >= plannedMinutes + CHECK_IN_PAST_PLAN_MINUTES ||
    elapsedMinutes >= CHECK_IN_MAX_HOURS_MINUTES;

  return {
    session,
    isActive: session.status === 'active',
    elapsedMinutes,
    remainingMinutes,
    progressPercentage,
    isPastPlanned,
    isCompleted: false,
    checkInPrompt,
    strongEndFastPrompt,
  };
}

// -----------------------------------------------------------------------------
// Scheduled-Window Mode (PRD 6.20 FST-4)
// -----------------------------------------------------------------------------

function parseHHMM(timeStr: string): { hour: number; minute: number } {
  const parts = timeStr.split(':');
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  return {
    hour: isNaN(h) ? 0 : Math.max(0, Math.min(23, h)),
    minute: isNaN(m) ? 0 : Math.max(0, Math.min(59, m)),
  };
}

/**
 * Calculates current eating/fasting state and upcoming window transitions based on
 * the user's scheduled daily eating window.
 * DST-safe and timezone-aware.
 */
/** Convert a wall-clock date/time to UTC, using the zone's offset on that date. */
export function fastingTimeToUtc(date: string, time: string, timezone: string): Date {
  const nominal = Date.parse(date + 'T' + time + ':00Z');
  if (
    !Number.isFinite(nominal) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
    new Date(nominal).toISOString().slice(0, 10) !== date
  )
    throw new Error('INVALID_FASTING_TIMES');
  let guess = nominal;
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const seen = new Set<number>();
  for (let index = 0; index < 5; index++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]),
    );
    const wall = Date.parse(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`,
    );
    const next = guess + (nominal - wall);
    if (next === guess) return new Date(guess);
    // A skipped spring-forward wall time resolves forward to the next valid clock time.
    if (seen.has(next)) return new Date(Math.max(next, guess));
    seen.add(guess);
    guess = next;
  }
  return new Date(guess);
}
export function calculateScheduledWindow(params: {
  eatingWindowStart: string;
  eatingWindowEnd: string;
  referenceTime?: string | Date;
  timezone?: string;
}): ScheduledWindowModeState {
  const { eatingWindowStart, eatingWindowEnd, timezone = 'UTC' } = params;
  const now = params.referenceTime ? new Date(params.referenceTime) : new Date();
  const localDate = getLocalDateString(now, timezone);
  const events = Array.from({ length: 5 }, (_, index) => addDaysToDateString(localDate, index - 2))
    .flatMap((date) => [
      { kind: 'eating' as const, time: fastingTimeToUtc(date, eatingWindowStart, timezone) },
      { kind: 'fasting' as const, time: fastingTimeToUtc(date, eatingWindowEnd, timezone) },
    ])
    .sort((a, b) => a.time.getTime() - b.time.getTime());
  const previous = events.filter((event) => event.time <= now).at(-1)!;
  const next = events.find((event) => event.time > now)!;
  const nextEat = events.find((event) => event.kind === 'eating' && event.time > now)!;
  const nextFast = events.find((event) => event.kind === 'fasting' && event.time > now)!;
  const endAfterFast = events.find(
    (event) => event.kind === 'eating' && event.time > nextFast.time,
  )!;
  const start = parseHHMM(eatingWindowStart),
    end = parseHHMM(eatingWindowEnd);
  const eatingMinutes = (end.hour * 60 + end.minute - start.hour * 60 - start.minute + 1440) % 1440;
  return {
    isEatingWindow: previous.kind === 'eating',
    currentWindowStart: previous.time.toISOString(),
    currentWindowEnd: next.time.toISOString(),
    nextEatingWindowStart: nextEat.time.toISOString(),
    nextEatingWindowEnd: nextFast.time.toISOString(),
    nextFastingWindowStart: nextFast.time.toISOString(),
    nextFastingWindowEnd: endAfterFast.time.toISOString(),
    plannedFastingMinutes: Math.min(1200, Math.max(60, 1440 - eatingMinutes)),
  };
}
export function validateFastingSettings(
  settings: Pick<
    FastingSettings,
    'protocol' | 'custom_fasting_hours' | 'eating_window_start' | 'eating_window_end'
  >,
): boolean {
  if (!Object.hasOwn(FASTING_PROTOCOLS, settings.protocol)) return false;
  if (
    settings.protocol === 'custom' &&
    (!Number.isInteger(settings.custom_fasting_hours) ||
      settings.custom_fasting_hours! < 1 ||
      settings.custom_fasting_hours! > 20)
  )
    return false;
  if (
    ![settings.eating_window_start, settings.eating_window_end].every((value) =>
      /^([01]\d|2[0-3]):[0-5]\d$/.test(value),
    )
  )
    return false;
  const start = parseHHMM(settings.eating_window_start),
    end = parseHHMM(settings.eating_window_end);
  const minutes = (end.hour * 60 + end.minute - start.hour * 60 - start.minute + 1440) % 1440;
  return minutes >= 240 && minutes <= 1380;
}
export function fastingWindowForProtocol(
  protocol: FastingProtocol,
  customHours?: number | null,
  end = '20:00',
) {
  const parsed = parseHHMM(end);
  const start =
    (parsed.hour * 60 +
      parsed.minute -
      (1440 - getProtocolPlannedMinutes(protocol, customHours)) +
      1440) %
    1440;
  return {
    start: `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`,
    end,
  };
}

// -----------------------------------------------------------------------------
// Stats Calculation (PRD 6.20 FST-7)
// -----------------------------------------------------------------------------

/**
 * Calculates fasting summary statistics:
 * - total fasts, completed, ended early
 * - completion rate percentage
 * - average duration in minutes and hours
 * - total fasting hours
 * - longest fast duration
 */
export function calculateFastingStats(sessions: FastingSession[]): FastingStats {
  if (!sessions || sessions.length === 0) {
    return {
      total_fasts: 0,
      completed_fasts: 0,
      ended_early_fasts: 0,
      completion_rate_pct: 0,
      average_duration_minutes: 0,
      average_duration_hours: 0,
      total_fasting_hours: 0,
      longest_fast_minutes: 0,
    };
  }

  let completedCount = 0;
  let endedEarlyCount = 0;
  let totalDurationMinutes = 0;
  let longestFastMinutes = 0;
  let finishedCount = 0;

  for (const session of sessions) {
    const startMs = new Date(session.start_at).getTime();
    let durationMins = 0;

    if (session.end_at) {
      const endMs = new Date(session.end_at).getTime();
      durationMins = Math.max(0, Math.round((endMs - startMs) / 60000));
      finishedCount++;

      if (session.status === 'completed' || durationMins >= session.planned_minutes) {
        completedCount++;
      } else {
        endedEarlyCount++;
      }
    } else {
      // Active fast duration up to now
      durationMins = Math.max(0, Math.round((Date.now() - startMs) / 60000));
    }

    totalDurationMinutes += durationMins;
    if (durationMins > longestFastMinutes) {
      longestFastMinutes = durationMins;
    }
  }

  const total = sessions.length;
  const completionRate =
    finishedCount > 0 ? Math.round((completedCount / finishedCount) * 1000) / 10 : 0;
  const avgMins = finishedCount > 0 ? Math.round(totalDurationMinutes / finishedCount) : 0;
  const avgHours = Math.round((avgMins / 60) * 10) / 10;
  const totalHours = Math.round((totalDurationMinutes / 60) * 10) / 10;

  return {
    total_fasts: total,
    completed_fasts: completedCount,
    ended_early_fasts: endedEarlyCount,
    completion_rate_pct: completionRate,
    average_duration_minutes: avgMins,
    average_duration_hours: avgHours,
    total_fasting_hours: totalHours,
    longest_fast_minutes: longestFastMinutes,
  };
}

// -----------------------------------------------------------------------------
// Fasting Streak (PRD 6.20 FST-8, 7.9)
// -----------------------------------------------------------------------------

/**
 * Calculates the personal fasting streak.
 * Rule (PRD 7.9):
 * - The fasting streak counts consecutive days with a Completed planned fast.
 * - Ended early fasts DO NOT count toward the streak, but there is no penalty/shaming.
 * - Personal only (never shared on leaderboards or consistency score).
 * - Timezone and DST safe.
 */
export function calculateFastingStreak(
  sessions: FastingSession[],
  _timezone = 'UTC',
  referenceDate?: string | Date,
): FastingStreak {
  if (!sessions || sessions.length === 0) {
    return {
      current_streak: 0,
      longest_streak: 0,
      last_completed_date: null,
    };
  }

  // Filter completed sessions and extract unique local dates
  const completedDatesSet = new Set<string>();

  for (const session of sessions) {
    if (session.status === 'completed' && session.end_at) {
      const startMs = new Date(session.start_at).getTime();
      const endMs = new Date(session.end_at).getTime();
      const actualMins = Math.round((endMs - startMs) / 60000);
      if (actualMins >= session.planned_minutes) {
        completedDatesSet.add(session.local_date);
      }
    }
  }

  if (completedDatesSet.size === 0) {
    return {
      current_streak: 0,
      longest_streak: 0,
      last_completed_date: null,
    };
  }

  const sortedDates = Array.from(completedDatesSet).sort();
  const lastCompletedDate = sortedDates[sortedDates.length - 1] ?? null;

  // Determine today's local date
  const now = referenceDate ? new Date(referenceDate) : new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Compute yesterday string
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // Calculate current streak
  let currentStreak = 0;
  let checkDate: Date | null = new Date(now);

  if (completedDatesSet.has(todayStr)) {
    // Start checking backwards from today
  } else if (completedDatesSet.has(yesterdayStr)) {
    // Today not completed yet, but yesterday was -> streak is still alive
    checkDate.setUTCDate(checkDate.getUTCDate() - 1);
  } else {
    // Neither today nor yesterday had a completed fast -> streak is 0
    checkDate = null;
  }

  if (checkDate) {
    while (completedDatesSet.has(checkDate.toISOString().slice(0, 10))) {
      currentStreak++;
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    }
  }

  // Calculate longest streak across all history
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate: Date | null = null;

  for (const dateStr of sortedDates) {
    const curDate = new Date(`${dateStr}T00:00:00.000Z`);
    if (!prevDate) {
      tempStreak = 1;
    } else {
      const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / (86400 * 1000));
      if (diffDays === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }
    prevDate = curDate;
  }

  return {
    current_streak: currentStreak,
    longest_streak: Math.max(longestStreak, currentStreak),
    last_completed_date: lastCompletedDate,
  };
}

// -----------------------------------------------------------------------------
// Gating Matrix (PRD 6.20 FST-1, FST-11, 6.2 ONB-11, 7.9, 8.1)
// -----------------------------------------------------------------------------

/**
 * Strict safety gating evaluation:
 * 1. 18+ only: Users under 18 cannot access fasting (hidden).
 * 2. Screening (ONB-11): Hidden if pregnant/breastfeeding, diabetes/medication affecting food, or history of an eating disorder.
 * 3. Low-intake check-in: Paused while low_intake_flag is active.
 */
export function evaluateFastingGating(params: {
  age: number;
  healthScreening?: HealthScreening | null;
  lowIntakeFlagActive?: boolean;
}): FastingGatingResult {
  const { age, healthScreening, lowIntakeFlagActive } = params;

  // 1. Age gate (18+)
  if (age < 18) {
    return {
      canAccess: false,
      isPaused: false,
      isHidden: true,
      reason: 'under_18',
    };
  }

  // 2. Health screening gates (ONB-11)
  if (healthScreening) {
    if (healthScreening.pregnant_or_breastfeeding) {
      return {
        canAccess: false,
        isPaused: false,
        isHidden: true,
        reason: 'pregnant_or_breastfeeding',
      };
    }

    if (healthScreening.has_diabetes_or_medication) {
      return {
        canAccess: false,
        isPaused: false,
        isHidden: true,
        reason: 'diabetes_or_medication',
      };
    }

    if (healthScreening.has_eating_disorder_history) {
      return {
        canAccess: false,
        isPaused: false,
        isHidden: true,
        reason: 'eating_disorder_history',
      };
    }
  }

  // 3. Low intake check-in gate (temporary pause)
  if (lowIntakeFlagActive) {
    return {
      canAccess: false,
      isPaused: true,
      isHidden: false,
      reason: 'low_intake_paused',
    };
  }

  // Eligible
  return {
    canAccess: true,
    isPaused: false,
    isHidden: false,
  };
}

// -----------------------------------------------------------------------------
// Safety Behaviour & Prompts (PRD 6.20 FST-5, FST-10, FST-11, 7.9)
// -----------------------------------------------------------------------------

/**
 * Safety prompt evaluation for active fasts:
 * - Check-in prompt: when fast runs 2h past plan OR past 20h.
 * - Strong end-fast prompt: at 24 hours.
 */
export function evaluateFastingSafetyPrompts(
  elapsedMinutes: number,
  plannedMinutes: number,
): {
  checkInPrompt: boolean;
  strongEndFastPrompt: boolean;
  reason?: 'past_plan_2h' | 'past_20h' | 'at_or_past_24h';
} {
  if (elapsedMinutes >= STRONG_END_FAST_MINUTES) {
    return {
      checkInPrompt: true,
      strongEndFastPrompt: true,
      reason: 'at_or_past_24h',
    };
  }

  if (elapsedMinutes >= plannedMinutes + CHECK_IN_PAST_PLAN_MINUTES) {
    return {
      checkInPrompt: true,
      strongEndFastPrompt: false,
      reason: 'past_plan_2h',
    };
  }

  if (elapsedMinutes >= CHECK_IN_MAX_HOURS_MINUTES) {
    return {
      checkInPrompt: true,
      strongEndFastPrompt: false,
      reason: 'past_20h',
    };
  }

  return {
    checkInPrompt: false,
    strongEndFastPrompt: false,
  };
}

/**
 * Non-blocking prompt copy when user logs food during an active fast (PRD FST-5).
 * Food logging is NEVER blocked.
 */
export function getFoodLogFastingPrompt(isFastingActive: boolean): {
  shouldPrompt: boolean;
  title?: string;
  message?: string;
} {
  if (!isFastingActive) {
    return { shouldPrompt: false };
  }

  return {
    shouldPrompt: true,
    title: 'Log this and end your fast?',
    message:
      'You have an active fast running. Would you like to end your fast now, or keep your timer going?',
  };
}

// -----------------------------------------------------------------------------
// Local Notification Schedules (PRD 6.20 FST-6, Phase 9 local service)
// -----------------------------------------------------------------------------

/**
 * Builds local notification schedules for:
 * 1. Fast end reminder: when planned duration is reached
 * 2. Eating window closing reminder: 30 minutes before eating window ends
 * 3. Fast start reminder: at scheduled fasting start
 * Respects quiet hours and pause settings.
 */
export function buildFastingReminderSchedules(params: {
  settings: FastingSettings;
  activeSession?: FastingSession | null;
  quietHoursSettings?: {
    enabled: boolean;
    start: string;
    end: string;
  };
  referenceTime?: Date;
  timezone?: string;
}): LocalReminderSchedule[] {
  const { settings, activeSession, quietHoursSettings, referenceTime, timezone = 'UTC' } = params;
  if (!settings.enabled) return [];

  const schedules: LocalReminderSchedule[] = [];
  const now = referenceTime ?? new Date();

  // 1. Fast End Reminder (if fast is currently active)
  if (activeSession && activeSession.status === 'active' && !activeSession.end_at) {
    const startMs = new Date(activeSession.start_at).getTime();
    const targetEndMs = startMs + activeSession.planned_minutes * 60000;
    const diffSecs = Math.floor((targetEndMs - now.getTime()) / 1000);

    if (diffSecs > 0) {
      const targetDate = new Date(targetEndMs);
      const timeStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(targetDate);

      const suppressedByQuietHours =
        quietHoursSettings?.enabled &&
        isQuietHours(timeStr, quietHoursSettings.start, quietHoursSettings.end);

      if (!suppressedByQuietHours) {
        schedules.push({
          id: `fasting_end_${activeSession.id}`,
          type: 'fasting',
          title: 'Planned fast ended',
          body: 'You’ve reached your fasting target. Break your fast gently.',
          trigger: {
            seconds: diffSecs,
            repeats: false,
          },
          data: {
            fastingType: 'fast_end',
            sessionId: activeSession.id,
            url: '/fasting',
          },
        });
      }
    }
  }

  const startClock = parseHHMM(settings.eating_window_end);
  if (
    !quietHoursSettings?.enabled ||
    !isQuietHours(settings.eating_window_end, quietHoursSettings.start, quietHoursSettings.end)
  )
    schedules.push({
      id: 'fasting_start',
      type: 'fasting',
      title: 'Fasting window starts',
      body: 'Your scheduled eating window has ended.',
      trigger: { hour: startClock.hour, minute: startClock.minute, repeats: true },
      data: { fastingType: 'fast_start', url: '/fasting' },
    });

  // 2. Eating window closing reminder (30 minutes before eating window end)
  if (settings.eating_window_end) {
    const endParsed = parseHHMM(settings.eating_window_end);
    let closingHour = endParsed.hour;
    let closingMinute = endParsed.minute - 30;
    if (closingMinute < 0) {
      closingMinute += 60;
      closingHour = (closingHour - 1 + 24) % 24;
    }

    const timeStr = `${String(closingHour).padStart(2, '0')}:${String(closingMinute).padStart(2, '0')}`;
    const suppressedByQuietHours =
      quietHoursSettings?.enabled &&
      isQuietHours(timeStr, quietHoursSettings.start, quietHoursSettings.end);

    if (!suppressedByQuietHours) {
      schedules.push({
        id: 'fasting_eating_window_closing',
        type: 'fasting',
        title: 'Eating window closing soon',
        body: '30 minutes left in your eating window.',
        trigger: {
          hour: closingHour,
          minute: closingMinute,
          repeats: true,
        },
        data: {
          fastingType: 'window_closing',
          url: '/fasting',
        },
      });
    }
  }

  return schedules;
}

// -----------------------------------------------------------------------------
// Progress Calculation (PRD 6.20 FST-7, Hook Data for Progress)
// -----------------------------------------------------------------------------

/**
 * Calculates weekly/range progress metrics for fasting hours:
 * - total fasts, completed fasts
 * - average duration
 * - completion rate
 * - total fasting hours
 * - fasting hours per week (total hours / (days / 7))
 * - daily breakdown of hours and completion
 */
export function calculateFastingProgress(
  sessions: FastingSession[],
  startDate: string,
  endDate: string,
): IndividualFastingProgress {
  const startMs = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const endMs = new Date(`${endDate}T23:59:59.999Z`).getTime();
  const totalDays = Math.max(1, Math.round((endMs - startMs) / (86400 * 1000)));

  const filteredSessions = sessions.filter((s) => {
    const sessionStartMs = new Date(s.start_at).getTime();
    return sessionStartMs >= startMs && sessionStartMs <= endMs;
  });

  const stats = calculateFastingStats(filteredSessions);
  const fastingHoursPerWeek =
    totalDays > 0 ? Math.round((stats.total_fasting_hours / (totalDays / 7.0)) * 10) / 10 : 0;

  // Daily map
  const dailyMap = new Map<string, { minutes: number; completed: boolean }>();

  for (const session of filteredSessions) {
    const date = session.local_date;
    const sessionStart = new Date(session.start_at).getTime();
    const sessionEnd = session.end_at ? new Date(session.end_at).getTime() : Date.now();
    const durationMins = Math.max(0, Math.round((sessionEnd - sessionStart) / 60000));
    const isCompleted = session.status === 'completed' || durationMins >= session.planned_minutes;

    const existing = dailyMap.get(date) ?? { minutes: 0, completed: false };
    existing.minutes += durationMins;
    if (isCompleted) existing.completed = true;
    dailyMap.set(date, existing);
  }

  const daily_hours: IndividualFastingDailyHours[] = [];
  const curDate = new Date(`${startDate}T00:00:00.000Z`);
  const finalDate = new Date(`${endDate}T00:00:00.000Z`);

  while (curDate.getTime() <= finalDate.getTime()) {
    const dStr = curDate.toISOString().slice(0, 10);
    const dayEntry = dailyMap.get(dStr);
    const hours = dayEntry ? Math.round((dayEntry.minutes / 60) * 10) / 10 : 0;
    daily_hours.push({
      date: dStr,
      fasting_hours: hours,
      completed: dayEntry?.completed ?? false,
    });
    curDate.setUTCDate(curDate.getUTCDate() + 1);
  }

  return {
    total_fasts: stats.total_fasts,
    completed_fasts: stats.completed_fasts,
    ended_early_fasts: stats.ended_early_fasts,
    completion_rate_pct: stats.completion_rate_pct,
    average_duration_minutes: stats.average_duration_minutes,
    average_duration_hours: stats.average_duration_hours,
    total_fasting_hours: stats.total_fasting_hours,
    fasting_hours_per_week: fastingHoursPerWeek,
    daily_hours,
  };
}
