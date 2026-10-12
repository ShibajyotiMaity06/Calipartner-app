import { describe, expect, it } from 'vitest';
import {
  buildLocalReminderSchedules,
  formatNotificationCopy,
  getDefaultNotificationSettings,
  isQuietHours,
  sanitizePushPayload,
  shouldDeliverNotification,
  validateFcmToken,
} from './notifications';
import type { PushPayload } from './types';

describe('Phase 9 Core: Notifications, Quiet Hours, Safety & Schedules', () => {
  describe('isQuietHours', () => {
    it('correctly handles overnight quiet hours (e.g. 22:00 to 07:00)', () => {
      // Overnight: 22:00 to 07:00
      expect(isQuietHours('22:00', '22:00', '07:00')).toBe(true);
      expect(isQuietHours('23:45', '22:00', '07:00')).toBe(true);
      expect(isQuietHours('00:00', '22:00', '07:00')).toBe(true);
      expect(isQuietHours('04:30', '22:00', '07:00')).toBe(true);
      expect(isQuietHours('06:59', '22:00', '07:00')).toBe(true);
      expect(isQuietHours('07:00', '22:00', '07:00')).toBe(false);
      expect(isQuietHours('12:00', '22:00', '07:00')).toBe(false);
      expect(isQuietHours('21:59', '22:00', '07:00')).toBe(false);
    });

    it('correctly handles daytime quiet hours (e.g. 13:00 to 15:00)', () => {
      expect(isQuietHours('13:00', '13:00', '15:00')).toBe(true);
      expect(isQuietHours('14:30', '13:00', '15:00')).toBe(true);
      expect(isQuietHours('15:00', '13:00', '15:00')).toBe(false);
      expect(isQuietHours('12:59', '13:00', '15:00')).toBe(false);
      expect(isQuietHours('20:00', '13:00', '15:00')).toBe(false);
    });

    it('returns false for matching start and end or missing inputs', () => {
      expect(isQuietHours('10:00', '10:00', '10:00')).toBe(false);
      expect(isQuietHours('', '22:00', '07:00')).toBe(false);
    });
  });

  describe('shouldDeliverNotification', () => {
    const defaultSettings = getDefaultNotificationSettings('user-1');

    it('blocks notification if pause_all is true', () => {
      const settings = { ...defaultSettings, pause_all: true };
      const decision = shouldDeliverNotification({
        settings,
        type: 'nudge',
      });
      expect(decision.deliver).toBe(false);
      expect(decision.reason).toBe('pause_all');
    });

    it('blocks notification if specific type toggle is disabled', () => {
      const settings = { ...defaultSettings, nudge_enabled: false };
      const decision = shouldDeliverNotification({
        settings,
        type: 'nudge',
      });
      expect(decision.deliver).toBe(false);
      expect(decision.reason).toBe('type_disabled');
    });

    it('blocks chat message notification if room chat is muted', () => {
      const decision = shouldDeliverNotification({
        settings: defaultSettings,
        type: 'chat_message',
        roomChatMuted: true,
      });
      expect(decision.deliver).toBe(false);
      expect(decision.reason).toBe('room_chat_muted');
    });

    it('skips chat push if recipient is actively viewing the chat', () => {
      const decision = shouldDeliverNotification({
        settings: defaultSettings,
        type: 'chat_message',
        isViewingChat: true,
      });
      expect(decision.deliver).toBe(false);
      expect(decision.reason).toBe('currently_viewing_chat');
    });

    it('blocks notification during quiet hours if enabled', () => {
      const settings = {
        ...defaultSettings,
        quiet_hours_enabled: true,
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00',
      };
      const decision = shouldDeliverNotification({
        settings,
        type: 'partner_workout',
        currentTimeLocal: '23:15',
      });
      expect(decision.deliver).toBe(false);
      expect(decision.reason).toBe('quiet_hours');
    });

    it('delivers notification outside quiet hours', () => {
      const settings = {
        ...defaultSettings,
        quiet_hours_enabled: true,
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00',
      };
      const decision = shouldDeliverNotification({
        settings,
        type: 'partner_workout',
        currentTimeLocal: '16:00',
      });
      expect(decision.deliver).toBe(true);
    });
  });

  describe('sanitizePushPayload & Privacy (PRD 6.12 NTF-3)', () => {
    it('strips calorie numbers from message body', () => {
      const payload: PushPayload = {
        title: 'Rahul logged food',
        body: 'Rahul logged lunch containing 750 kcal with 45g protein',
        data: {
          type: 'partner_food',
          roomId: 'room-1',
          calories: 750,
          protein_g: 45,
        },
      };

      const sanitized = sanitizePushPayload(payload, false);
      expect(sanitized.body).not.toContain('750 kcal');
      expect(sanitized.body).toContain('logged meal');
      expect(sanitized.data.calories).toBeUndefined();
      expect(sanitized.data.protein_g).toBeUndefined();
      expect(sanitized.data.roomId).toBe('room-1');
    });

    it('hides chat preview when hidePreviews is true', () => {
      const payload: PushPayload = {
        title: 'Rahul in Beast Mode',
        body: 'Hey are we hitting chest today?',
        data: {
          type: 'chat_message',
          roomName: 'Beast Mode',
          messageId: 'msg-123',
        },
      };

      const sanitized = sanitizePushPayload(payload, true);
      expect(sanitized.body).toBe('New message received');
      expect(sanitized.title).toBe('Beast Mode');
    });
  });

  describe('formatNotificationCopy', () => {
    it('produces supportive non-shaming copy for streak at risk', () => {
      const copy = formatNotificationCopy('streak_at_risk', { streakDays: 5 });
      expect(copy.title).toBe('Keep your streak alive!');
      expect(copy.body).toContain('5-day streak');
    });

    it('produces supportive copy for partner workouts without showing sets/weights', () => {
      const copy = formatNotificationCopy('partner_workout', {
        senderNickname: 'Aarav',
        workoutTitle: 'Leg Day',
      });
      expect(copy.title).toBe('Aarav finished a workout!');
      expect(copy.body).toBe('Aarav completed: Leg Day');
      expect(copy.body).not.toContain('kg');
    });

    it('produces weekly summary copy', () => {
      const copy = formatNotificationCopy('weekly_summary', {});
      expect(copy.title).toBe('Your Weekly Summary is ready');
    });
  });

  describe('validateFcmToken', () => {
    it('validates tokens properly', () => {
      expect(validateFcmToken('fcm_token_abcdef1234567890_valid_length_token_string')).toBe(true);
      expect(validateFcmToken('')).toBe(false);
      expect(validateFcmToken('short')).toBe(false);
      expect(validateFcmToken('invalid token with spaces!#$')).toBe(false);
    });
  });

  describe('buildLocalReminderSchedules', () => {
    it('generates local reminders for meals, water, and weigh-in', () => {
      const settings = getDefaultNotificationSettings('user-1');
      const schedules = buildLocalReminderSchedules(settings);

      expect(schedules.length).toBeGreaterThan(0);

      // Meal reminders
      const breakfast = schedules.find((s) => s.id === 'meal_reminder_breakfast');
      expect(breakfast).toBeDefined();
      expect(breakfast?.trigger.hour).toBe(8);
      expect(breakfast?.trigger.minute).toBe(30);

      // Water reminders
      const water = schedules.filter((s) => s.type === 'water');
      expect(water.length).toBeGreaterThan(0);

      // Weigh-in reminder
      const weighIn = schedules.find((s) => s.id === 'weigh_in_reminder');
      expect(weighIn).toBeDefined();
      expect(weighIn?.trigger.weekday).toBe(1); // Monday
    });

    it('returns empty array if pause_all is true', () => {
      const settings = {
        ...getDefaultNotificationSettings('user-1'),
        pause_all: true,
      };
      const schedules = buildLocalReminderSchedules(settings);
      expect(schedules).toEqual([]);
    });
  });
});
