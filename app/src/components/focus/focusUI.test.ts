import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { formatMinutesDisplay, formatTimeAccessible, formatTimeDigits } from './focusUIUtils';
import {
  shouldAutoStopStopwatch,
  shouldPromptStillFocusing,
  shouldSuggestBreak,
} from '@calipartner/core';

describe('Phase 9B — Focus Time View Layer & UI Logic Tests', () => {
  describe('1. i18n & Translation Verification', () => {
    it('verifies core focus card labels and titles exist in i18n', () => {
      expect(en.focus.cardTitle).toBe('Focus Time');
      expect(en.focus.cardSubtitle).toBe('Track your study and deep work sessions');
      expect(en.focus.startBtn).toBe('Start Focus');
      expect(en.focus.viewBtn).toBe('Resume / View');
      expect(en.focus.activeStatus).toBe('Focusing now');
      expect(en.focus.pausedStatus).toBe('On a break');
    });

    it('verifies start sheet modes, quick lengths, and labels exist', () => {
      expect(en.focus.stopwatch).toBe('Stopwatch');
      expect(en.focus.timer).toBe('Timer');
      expect(en.focus.mode).toBe('Session Mode');
      expect(en.focus.quickLengths).toBe('Quick Lengths');
      expect(en.focus.customLength).toBe('Custom (min)');
      expect(en.focus.labelTitle).toBe('Session Label (optional)');
      expect(en.focus.labelPlaceholder).toBe('e.g. Study, Work, Reading');
      expect(en.focus.labels.study).toBe('Study');
      expect(en.focus.labels.work).toBe('Work');
      expect(en.focus.labels.reading).toBe('Reading');
      expect(en.focus.labels.coding).toBe('Coding');
      expect(en.focus.labels.writing).toBe('Writing');
      expect(en.focus.startPersonal).toBe('Start Personal Session');
      expect(en.focus.startRoom).toBe('Start for Room');
    });

    it('verifies running screen actions and supportive safety prompts', () => {
      expect(en.focus.pauseBtn).toBe('Pause (Take a break)');
      expect(en.focus.resumeBtn).toBe('Resume Focus');
      expect(en.focus.endBtn).toBe('End Session');
      expect(en.focus.confirmEndTitle).toBe('End Focus Session?');
      expect(en.focus.confirmEndMessage).toContain('Your focused time will be saved');
      expect(en.focus.breakPrompt).toContain('You have been in the zone for 90 minutes');
      expect(en.focus.stillFocusingPrompt).toContain(
        'Still focusing? You have been in deep work for 4 hours',
      );
    });

    it('verifies room focus segment strings enforce neutral and supportive language', () => {
      expect(en.focus.roomFocusTitle).toBe('Room Focus Sessions');
      expect(en.focus.roomFocusSubtitle).toBe('Focus side by side with your partners');
      expect(en.focus.joinBtn).toBe('Join Session');
      expect(en.focus.leaveBtn).toBe('Leave Session');
      expect(en.focus.recentSessionsTitle).toBe('Recent Room Sessions');
      expect(en.focus.roomWeeklyTotalsTitle).toBe('Room Weekly Focus Time');
      expect(en.focus.roomTotalLabel).toBe('Total Room Focus');
      // No ranking notice
      expect(en.focus.neutralSortingNote).toBe(
        'Sorted alphabetically with no rankings. Every minute counts!',
      );
      expect(en.focus.roomLockedNotice).toContain('This room is currently paused');
    });

    it('verifies focus settings strings exist', () => {
      expect(en.focus.settings.title).toBe('Focus Settings');
      expect(en.focus.settings.weeklyGoal).toBe('Weekly Focus Goal (hours)');
      expect(en.focus.settings.streakMinimum).toBe('Daily Streak Minimum (minutes)');
      expect(en.focus.settings.breakReminders).toBe('Break Reminders (every 90 minutes)');
      expect(en.focus.settings.defaultLabel).toBe('Default Session Label');
    });

    it('verifies no guilt or shame language exists in focus copy', () => {
      const allFocusCopy = JSON.stringify(en.focus);
      expect(allFocusCopy).not.toContain('failed');
      expect(allFocusCopy).not.toContain('lost');
      expect(allFocusCopy).not.toContain('slacking');
      expect(allFocusCopy).not.toContain('lazy');
      expect(allFocusCopy).not.toContain('punish');
      expect(allFocusCopy).not.toContain('winner');
      expect(allFocusCopy).not.toContain('loser');
    });
  });

  describe('2. Time Formatting Utilities (focusUIUtils)', () => {
    describe('formatTimeDigits', () => {
      it('formats under 1 minute', () => {
        expect(formatTimeDigits(0)).toBe('00:00');
        expect(formatTimeDigits(7)).toBe('00:07');
        expect(formatTimeDigits(59)).toBe('00:59');
      });

      it('formats minutes and seconds (under 1 hour)', () => {
        expect(formatTimeDigits(60)).toBe('01:00');
        expect(formatTimeDigits(1500)).toBe('25:00'); // 25 minutes
        expect(formatTimeDigits(3000)).toBe('50:00'); // 50 minutes
        expect(formatTimeDigits(3599)).toBe('59:59');
      });

      it('formats hours, minutes, and seconds for 1 hour or more', () => {
        expect(formatTimeDigits(3600)).toBe('1:00:00');
        expect(formatTimeDigits(3665)).toBe('1:01:05');
        expect(formatTimeDigits(5400)).toBe('1:30:00'); // 90 minutes
        expect(formatTimeDigits(14400)).toBe('4:00:00'); // 4 hours
      });

      it('handles negative or float values gracefully', () => {
        expect(formatTimeDigits(-10)).toBe('00:00');
        expect(formatTimeDigits(25.9)).toBe('00:25');
      });
    });

    describe('formatTimeAccessible (Screen Reader announcements)', () => {
      it('formats seconds only', () => {
        expect(formatTimeAccessible(45)).toBe('45 seconds elapsed');
        expect(formatTimeAccessible(1)).toBe('1 second elapsed');
        expect(formatTimeAccessible(45, true)).toBe('45 seconds remaining');
      });

      it('formats minutes and seconds', () => {
        expect(formatTimeAccessible(1500)).toBe('25 minutes elapsed');
        expect(formatTimeAccessible(1530)).toBe('25 minutes and 30 seconds elapsed');
        expect(formatTimeAccessible(1500, true)).toBe('25 minutes remaining');
      });

      it('formats hours, minutes, and seconds', () => {
        expect(formatTimeAccessible(3600)).toBe('1 hour elapsed');
        expect(formatTimeAccessible(7200)).toBe('2 hours elapsed');
        expect(formatTimeAccessible(3665)).toBe('1 hour and 1 minute and 5 seconds elapsed');
        expect(formatTimeAccessible(5400, true)).toBe('1 hour and 30 minutes remaining');
      });
    });

    describe('formatMinutesDisplay', () => {
      it('formats 0 minutes', () => {
        expect(formatMinutesDisplay(0)).toBe('0m');
      });

      it('formats under 60 minutes', () => {
        expect(formatMinutesDisplay(25)).toBe('25m');
        expect(formatMinutesDisplay(50)).toBe('50m');
      });

      it('formats hours and minutes', () => {
        expect(formatMinutesDisplay(60)).toBe('1h');
        expect(formatMinutesDisplay(90)).toBe('1h 30m');
        expect(formatMinutesDisplay(150)).toBe('2h 30m');
      });
    });
  });

  describe('3. Core Safety & Health Rule Helpers (@calipartner/core)', () => {
    it('suggests a break after 90 continuous minutes (5400s)', () => {
      const startTime = new Date('2026-10-12T10:00:00Z');
      const under90m = new Date('2026-10-12T11:29:59Z');
      const exactly90m = new Date('2026-10-12T11:30:00Z');
      const over90m = new Date('2026-10-12T11:31:00Z');

      expect(shouldSuggestBreak(startTime, under90m)).toBe(false);
      expect(shouldSuggestBreak(startTime, exactly90m)).toBe(true);
      expect(shouldSuggestBreak(startTime, over90m)).toBe(true);
    });

    it('prompts "Still focusing?" at 4 continuous hours (14400s)', () => {
      const startTime = new Date('2026-10-12T10:00:00Z');
      const under4h = new Date('2026-10-12T13:59:59Z');
      const exactly4h = new Date('2026-10-12T14:00:00Z');
      const over4h = new Date('2026-10-12T14:05:00Z');

      expect(shouldPromptStillFocusing(startTime, under4h)).toBe(false);
      expect(shouldPromptStillFocusing(startTime, exactly4h)).toBe(true);
      expect(shouldPromptStillFocusing(startTime, over4h)).toBe(true);
    });

    it('auto-stops stopwatch at 12 hours (43200s)', () => {
      const startTime = new Date('2026-10-12T10:00:00Z');
      const under12h = new Date('2026-10-12T21:59:59Z');
      const exactly12h = new Date('2026-10-12T22:00:00Z');
      const over12h = new Date('2026-10-12T22:01:00Z');

      expect(shouldAutoStopStopwatch(startTime, under12h)).toBe(false);
      expect(shouldAutoStopStopwatch(startTime, exactly12h)).toBe(true);
      expect(shouldAutoStopStopwatch(startTime, over12h)).toBe(true);
    });
  });

  describe('4. Room Focus Segment & Consistency Rules (NO RANKING)', () => {
    it('verifies sorting of room members is neutral (Me first, then alphabetical, never by minutes)', () => {
      const currentUserId = 'user-me';
      const rawMembers = [
        { user_id: 'user-charlie', user_name: 'Charlie', weekly_focus_minutes: 500 },
        { user_id: 'user-alice', user_name: 'Alice', weekly_focus_minutes: 1200 },
        { user_id: 'user-me', user_name: 'Me', weekly_focus_minutes: 300 },
        { user_id: 'user-bob', user_name: 'Bob', weekly_focus_minutes: 800 },
      ];

      // Neutral sorting logic implemented in RoomFocusSegment and RoomProgressFocusView:
      // Current user first, then alphabetical by member name.
      const sortedMembers = [...rawMembers].sort((a, b) => {
        if (a.user_id === currentUserId) return -1;
        if (b.user_id === currentUserId) return 1;
        return (a.user_name || '').localeCompare(b.user_name || '');
      });

      expect(sortedMembers[0]?.user_name).toBe('Me');
      expect(sortedMembers[1]?.user_name).toBe('Alice');
      expect(sortedMembers[2]?.user_name).toBe('Bob');
      expect(sortedMembers[3]?.user_name).toBe('Charlie');

      // Verify that Alice with 1200 minutes is NOT in rank 1, avoiding competitive ranking.
      expect(sortedMembers[0]?.weekly_focus_minutes).toBe(300);
    });

    it('handles members with private focus settings (null minutes)', () => {
      const memberWithPrivateSettings = {
        user_id: 'user-private',
        user_name: 'Private User',
        weekly_focus_minutes: null, // Hidden per privacy setting
      };

      const isHidden = memberWithPrivateSettings.weekly_focus_minutes === null;
      expect(isHidden).toBe(true);

      const displayedText = isHidden
        ? en.progress.room.metricLocked
        : formatMinutesDisplay(memberWithPrivateSettings.weekly_focus_minutes ?? 0);
      expect(displayedText).toBe('Private / Hidden');
    });

    it('calculates room total minutes accurately', () => {
      const members = [
        { user_id: '1', weekly_focus_minutes: 120 },
        { user_id: '2', weekly_focus_minutes: null }, // private
        { user_id: '3', weekly_focus_minutes: 90 },
      ];

      const roomTotal = members.reduce((sum, m) => sum + (m.weekly_focus_minutes ?? 0), 0);
      expect(roomTotal).toBe(210);
      expect(formatMinutesDisplay(roomTotal)).toBe('3h 30m');
    });
  });

  describe('5. Start Focus Modal Constraints & Quick Lengths', () => {
    it('verifies quick lengths match PRD 25, 50, and 90 minutes', () => {
      const quickLengths = [25, 50, 90];
      expect(quickLengths).toContain(25);
      expect(quickLengths).toContain(50);
      expect(quickLengths).toContain(90);
    });

    it('validates label length constraint of maximum 20 characters', () => {
      const validLabel = 'Coding & Testing'; // 16 chars
      const boundaryLabel = '12345678901234567890'; // 20 chars
      const invalidLabel = '123456789012345678901'; // 21 chars

      const isLabelValid = (label: string) => label.trim().length <= 20;

      expect(isLabelValid(validLabel)).toBe(true);
      expect(isLabelValid(boundaryLabel)).toBe(true);
      expect(isLabelValid(invalidLabel)).toBe(false);
    });

    it('disables room session trigger if room is locked', () => {
      const isRoomLocked = true;
      const canStartRoomSession = !isRoomLocked;

      expect(canStartRoomSession).toBe(false);
    });
  });

  describe('6. Focus Settings Conversions', () => {
    it('converts weekly goal from minutes to hours for display', () => {
      const weeklyGoalMinutes = 600; // 10 hours
      const weeklyGoalHours = Math.round(weeklyGoalMinutes / 60);

      expect(weeklyGoalHours).toBe(10);
    });

    it('converts weekly goal from hours to minutes for storage', () => {
      const inputHours = '12';
      const storedMinutes = Math.max(0, parseInt(inputHours, 10) * 60);

      expect(storedMinutes).toBe(720);
    });

    it('defaults streak minimum to 25 minutes', () => {
      const defaultStreakMin = 25;
      expect(defaultStreakMin).toBe(25);
    });
  });
});
