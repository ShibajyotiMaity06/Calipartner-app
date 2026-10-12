import { describe, expect, it } from 'vitest';
import {
  calculateFocusedSeconds,
  calculateFocusStreak,
  calculateParticipantFocusedSeconds,
  calculateRemainingTimerSeconds,
  calculateWeeklyFocusStats,
  getDefaultFocusSettings,
  isExcessiveDailyFocus,
  shouldAutoStopStopwatch,
  shouldPromptStillFocusing,
  shouldSuggestBreak,
  sortRoomFocusMembers,
  splitSessionAcrossMidnight,
} from './focus';
import type { RoomMemberWeeklyFocus } from './types';

describe('Phase 9B: Focus Pure Logic & Formulas (PRD 6.25, 7.13)', () => {
  describe('calculateFocusedSeconds & calculateParticipantFocusedSeconds', () => {
    it('calculates focused time = end - start - paused', () => {
      const start = '2026-10-12T10:00:00Z';
      const end = '2026-10-12T10:50:00Z'; // 50 mins = 3000 seconds
      const paused = 300; // 5 mins paused

      const result = calculateFocusedSeconds(start, end, paused);
      expect(result).toBe(2700); // 45 minutes net
    });

    it('returns 0 when end is before start or invalid', () => {
      expect(calculateFocusedSeconds('2026-10-12T10:00:00Z', '2026-10-12T09:00:00Z', 0)).toBe(0);
      expect(calculateFocusedSeconds('invalid', '2026-10-12T09:00:00Z', 0)).toBe(0);
    });

    it('clamps to 0 if paused seconds exceed elapsed seconds', () => {
      const start = '2026-10-12T10:00:00Z';
      const end = '2026-10-12T10:10:00Z'; // 600s
      expect(calculateFocusedSeconds(start, end, 1000)).toBe(0);
    });

    it('calculates participant time = leave or session end - join - paused', () => {
      // Session started at 10:00, participant joined at 10:15 and left at 10:45
      const joinTime = '2026-10-12T10:15:00Z';
      const leaveTime = '2026-10-12T10:45:00Z'; // 30 mins = 1800s
      const paused = 120; // 2 mins paused

      const result = calculateParticipantFocusedSeconds(joinTime, leaveTime, paused);
      expect(result).toBe(1680); // 28 mins
    });
  });

  describe('calculateRemainingTimerSeconds', () => {
    it('returns remaining seconds if current time is before ends_at', () => {
      const endsAt = '2026-10-12T11:00:00Z';
      const current = '2026-10-12T10:40:00Z';
      expect(calculateRemainingTimerSeconds(endsAt, current)).toBe(1200); // 20 mins = 1200s
    });

    it('returns 0 if current time is after ends_at', () => {
      const endsAt = '2026-10-12T11:00:00Z';
      const current = '2026-10-12T11:05:00Z';
      expect(calculateRemainingTimerSeconds(endsAt, current)).toBe(0);
    });
  });

  describe('splitSessionAcrossMidnight', () => {
    it('keeps single day when session does not cross midnight (UTC)', () => {
      const split = splitSessionAcrossMidnight(
        {
          started_at: '2026-10-12T08:00:00Z',
          ended_at: '2026-10-12T09:30:00Z',
          paused_seconds: 0,
        },
        'UTC',
      );

      expect(split).toHaveLength(1);
      expect(split[0]!.local_date).toBe('2026-10-12');
      expect(split[0]!.focus_seconds).toBe(5400); // 90 min
      expect(split[0]!.focus_minutes).toBe(90);
    });

    it('splits session across UTC midnight', () => {
      // 23:00 to 01:30 UTC: 1 hour on 2026-10-12, 1.5 hours on 2026-10-13
      const split = splitSessionAcrossMidnight(
        {
          started_at: '2026-10-12T23:00:00Z',
          ended_at: '2026-10-13T01:30:00Z',
          paused_seconds: 0,
        },
        'UTC',
      );

      expect(split).toHaveLength(2);
      expect(split[0]!.local_date).toBe('2026-10-12');
      expect(split[0]!.focus_seconds).toBe(3600); // 1 hr = 3600s
      expect(split[0]!.focus_minutes).toBe(60);

      expect(split[1]!.local_date).toBe('2026-10-13');
      expect(split[1]!.focus_seconds).toBe(5400); // 1.5 hr = 5400s
      expect(split[1]!.focus_minutes).toBe(90);

      // Total sum matches exact net focused seconds
      expect(split[0]!.focus_seconds + split[1]!.focus_seconds).toBe(9000);
    });

    it('splits session across local midnight in Asia/Kolkata (IST = UTC+5:30)', () => {
      // In IST, 2026-10-12 23:30 IST is 18:00 UTC on 2026-10-12
      // 2026-10-13 01:00 IST is 19:30 UTC on 2026-10-12
      // Let's run a session from 18:00 UTC (23:30 IST) to 19:30 UTC (01:00 IST next day)
      const split = splitSessionAcrossMidnight(
        {
          started_at: '2026-10-12T18:00:00Z',
          ended_at: '2026-10-12T19:30:00Z',
          paused_seconds: 0,
        },
        'Asia/Kolkata',
      );

      expect(split).toHaveLength(2);
      expect(split[0]!.local_date).toBe('2026-10-12');
      expect(split[0]!.focus_seconds).toBe(1800); // 30 mins before midnight IST (23:30 to 00:00)
      expect(split[0]!.focus_minutes).toBe(30);

      expect(split[1]!.local_date).toBe('2026-10-13');
      expect(split[1]!.focus_seconds).toBe(3600); // 60 mins after midnight IST (00:00 to 01:00)
      expect(split[1]!.focus_minutes).toBe(60);

      expect(split[0]!.focus_seconds + split[1]!.focus_seconds).toBe(5400);
    });

    it('allocates paused time proportionally and preserves total exact focus seconds', () => {
      const split = splitSessionAcrossMidnight(
        {
          started_at: '2026-10-12T23:00:00Z',
          ended_at: '2026-10-13T01:00:00Z', // 2 hours total = 7200s
          paused_seconds: 1200, // 20 mins paused -> 6000s net
        },
        'UTC',
      );

      expect(split).toHaveLength(2);
      const sum = split[0]!.focus_seconds + split[1]!.focus_seconds;
      expect(sum).toBe(6000);
      expect(split[0]!.focus_seconds).toBe(3000);
      expect(split[1]!.focus_seconds).toBe(3000);
    });
  });

  describe('Auto-stop & Healthy-Use Safeguards (PRD FOC-8, FOC-12)', () => {
    it('auto-stops stopwatch at 12 hours (43200 seconds)', () => {
      const start = '2026-10-12T00:00:00Z';
      const at11h59m = '2026-10-12T11:59:59Z';
      const at12h = '2026-10-12T12:00:00Z';
      const at12h01m = '2026-10-12T12:01:00Z';

      expect(shouldAutoStopStopwatch(start, at11h59m)).toBe(false);
      expect(shouldAutoStopStopwatch(start, at12h)).toBe(true);
      expect(shouldAutoStopStopwatch(start, at12h01m)).toBe(true);
    });

    it('triggers "still focusing?" check after 4 hours (14400 seconds)', () => {
      const start = '2026-10-12T00:00:00Z';
      const at3h59m = '2026-10-12T03:59:59Z';
      const at4h = '2026-10-12T04:00:00Z';

      expect(shouldPromptStillFocusing(start, at3h59m)).toBe(false);
      expect(shouldPromptStillFocusing(start, at4h)).toBe(true);
    });

    it('suggests break after 90 minutes (5400 seconds) continuous focus', () => {
      const start = '2026-10-12T00:00:00Z';
      const at89m = '2026-10-12T01:29:00Z';
      const at90m = '2026-10-12T01:30:00Z';

      expect(shouldSuggestBreak(start, at89m)).toBe(false);
      expect(shouldSuggestBreak(start, at90m)).toBe(true);
    });

    it('flags excessive daily focus after 10 hours (600 minutes)', () => {
      expect(isExcessiveDailyFocus(599)).toBe(false);
      expect(isExcessiveDailyFocus(600)).toBe(true);
      expect(isExcessiveDailyFocus(720)).toBe(true);
    });
  });

  describe('calculateWeeklyFocusStats & getDefaultFocusSettings', () => {
    it('computes weekly totals, average, and goal completion percent', () => {
      const days = [
        { local_date: '2026-10-05', focus_minutes: 60 },
        { local_date: '2026-10-06', focus_minutes: 45 },
        { local_date: '2026-10-07', focus_minutes: 90 },
        { local_date: '2026-10-08', focus_minutes: 0 },
        { local_date: '2026-10-09', focus_minutes: 60 },
      ];
      // Total = 255 minutes, goal = 300 minutes -> 85%
      const stats = calculateWeeklyFocusStats(days, 300);
      expect(stats.total_minutes).toBe(255);
      expect(stats.daily_average_minutes).toBe(51);
      expect(stats.goal_completion_percent).toBe(85);
      expect(stats.remaining_minutes).toBe(45);
    });

    it('provides default settings with 5h goal and 25 min streak threshold', () => {
      const settings = getDefaultFocusSettings('user-1');
      expect(settings.user_id).toBe('user-1');
      expect(settings.weekly_goal_minutes).toBe(300);
      expect(settings.streak_minimum_minutes).toBe(25);
      expect(settings.break_reminders).toBe(true);
    });
  });

  describe('calculateFocusStreak', () => {
    it('counts consecutive days meeting the 25 min minimum threshold', () => {
      const days = [
        { local_date: '2026-10-09', focus_minutes: 30 }, // qualifies
        { local_date: '2026-10-10', focus_minutes: 45 }, // qualifies
        { local_date: '2026-10-11', focus_minutes: 25 }, // qualifies (meets threshold exactly)
        { local_date: '2026-10-12', focus_minutes: 50 }, // today, qualifies
      ];

      const streak = calculateFocusStreak(days, 25, '2026-10-12');
      expect(streak.current_streak).toBe(4);
      expect(streak.longest_streak).toBe(4);
    });

    it('maintains streak if today is not yet qualified but yesterday qualified', () => {
      const days = [
        { local_date: '2026-10-10', focus_minutes: 40 },
        { local_date: '2026-10-11', focus_minutes: 35 },
        { local_date: '2026-10-12', focus_minutes: 10 }, // today, below 25 min
      ];

      const streak = calculateFocusStreak(days, 25, '2026-10-12');
      expect(streak.current_streak).toBe(2); // Active streak from yesterday
    });

    it('resets streak to 0 if neither today nor yesterday qualified', () => {
      const days = [
        { local_date: '2026-10-08', focus_minutes: 50 },
        { local_date: '2026-10-09', focus_minutes: 60 },
        { local_date: '2026-10-10', focus_minutes: 10 }, // missed
        { local_date: '2026-10-11', focus_minutes: 15 }, // missed
        { local_date: '2026-10-12', focus_minutes: 5 }, // today missed
      ];

      const streak = calculateFocusStreak(days, 25, '2026-10-12');
      expect(streak.current_streak).toBe(0);
      expect(streak.longest_streak).toBe(2);
    });
  });

  describe('sortRoomFocusMembers', () => {
    it('orders "me" first, then alphabetically, never by ranking', () => {
      const members: RoomMemberWeeklyFocus[] = [
        {
          user_id: 'user-b',
          nickname: 'Zack',
          username: 'zack',
          is_me: false,
          is_hidden: false,
          weekly_focus_minutes: 1000,
        },
        {
          user_id: 'user-a',
          nickname: 'Alice',
          username: 'alice',
          is_me: false,
          is_hidden: false,
          weekly_focus_minutes: 800,
        },
        {
          user_id: 'user-me',
          nickname: 'Rahul',
          username: 'rahul',
          is_me: true,
          is_hidden: false,
          weekly_focus_minutes: 100,
        },
      ];

      const sorted = sortRoomFocusMembers(members, 'user-me');
      expect(sorted[0]!.user_id).toBe('user-me'); // Me first
      expect(sorted[1]!.nickname).toBe('Alice'); // Alphabetical
      expect(sorted[2]!.nickname).toBe('Zack');
    });
  });
});
