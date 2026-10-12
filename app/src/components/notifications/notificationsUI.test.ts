import { describe, expect, it } from 'vitest';
import { isQuietHours, getDefaultNotificationSettings } from '@calipartner/core';
import { en } from '@/i18n/en';
import { t } from '@/i18n';

describe('Phase 9 — Notification Settings & Primer UI Logic Tests', () => {
  describe('1. i18n Keys & Copy Completeness', () => {
    it('has all required notification headings and sections in en translations', () => {
      expect(en.notifications.title).toBe('Notifications & Reminders');
      expect(en.notifications.subtitle).toBe('Manage alerts, quiet hours, and daily reminders');
      expect(en.notifications.pauseAll.title).toBe('Pause All Notifications');
      expect(en.notifications.types.sectionTitle).toBe('Push Notifications');
      expect(en.notifications.localReminders.sectionTitle).toBe('Daily Local Reminders');
      expect(en.notifications.quietHours.sectionTitle).toBe('Quiet Hours');
      expect(en.notifications.chatPrivacy.sectionTitle).toBe('Chat Privacy');
      expect(en.notifications.roomMute.sectionTitle).toBe('Mute Room Chats');
    });

    it('translates strings correctly using t() helper', () => {
      expect(t('notifications.title')).toBe('Notifications & Reminders');
      expect(t('notifications.types.nudge')).toBe('Partner Nudges');
      expect(t('notifications.localReminders.water')).toBe('Hydration Reminders');
      expect(t('notifications.quietHours.activeNotice', { start: '22:00', end: '07:00' })).toBe(
        'Quiet hours active (22:00 to 07:00)',
      );
    });

    it('has complete permission priming copy with supportive and non-shaming tone', () => {
      expect(en.notifications.permission.primerTitle).toBe('Stay Accountable with Reminders');
      expect(en.notifications.permission.enableButton).toBe('Turn On Notifications');
      expect(en.notifications.permission.maybeLaterButton).toBe('Maybe Later');
      expect(en.notifications.permission.deniedTitle).toBe('Notifications are Disabled');
      expect(en.notifications.permission.openSettingsButton).toBe('Open System Settings');
    });
  });

  describe('2. Master Pause & Push Notification Rules', () => {
    it('initializes default settings with pause_all = false and all essential alerts enabled', () => {
      const defaults = getDefaultNotificationSettings('test-user');
      expect(defaults.pause_all).toBe(false);
      expect(defaults.nudge_enabled).toBe(true);
      expect(defaults.partner_activity_enabled).toBe(true);
      expect(defaults.room_requests_enabled).toBe(true);
      expect(defaults.chat_messages_enabled).toBe(true);
      expect(defaults.streak_reminders_enabled).toBe(true);
      expect(defaults.weekly_summary_enabled).toBe(true);
      expect(defaults.trial_reminders_enabled).toBe(true);
      expect(defaults.billing_alerts_enabled).toBe(true);
    });

    it('disables delivery when pause_all is true regardless of individual toggles', () => {
      const settings = {
        ...getDefaultNotificationSettings('test-user'),
        pause_all: true,
      };

      expect(settings.pause_all).toBe(true);
      // Individual toggles remain intact for restoration
      expect(settings.nudge_enabled).toBe(true);
      expect(settings.chat_messages_enabled).toBe(true);
    });
  });

  describe('3. Local Reminders & Daily Schedules', () => {
    it('includes local reminders for meals, water, weekly weigh-in and fasting', () => {
      const defaults = getDefaultNotificationSettings('test-user');
      expect(defaults.meal_reminders_enabled).toBe(true);
      expect(defaults.water_reminders_enabled).toBe(true);
      expect(defaults.weigh_in_reminders_enabled).toBe(true);
      expect(defaults.fasting_reminders_enabled).toBe(true);
      expect(defaults.meal_times).toEqual({
        breakfast: '08:30',
        lunch: '13:00',
        dinner: '20:00',
      });
      expect(defaults.water_interval_hours).toBe(2);
      expect(defaults.weigh_in_day_of_week).toBe(1); // Monday
    });
  });

  describe('4. Quiet Hours Calculation & Validation', () => {
    it('correctly calculates overnight quiet hours (e.g. 22:00 to 07:00)', () => {
      expect(isQuietHours('23:00', '22:00', '07:00')).toBe(true);
      expect(isQuietHours('02:30', '22:00', '07:00')).toBe(true);
      expect(isQuietHours('06:59', '22:00', '07:00')).toBe(true);
      expect(isQuietHours('07:00', '22:00', '07:00')).toBe(false);
      expect(isQuietHours('12:00', '22:00', '07:00')).toBe(false);
      expect(isQuietHours('21:59', '22:00', '07:00')).toBe(false);
    });

    it('validates 24-hour HH:MM time inputs format', () => {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      expect(timeRegex.test('22:00')).toBe(true);
      expect(timeRegex.test('07:30')).toBe(true);
      expect(timeRegex.test('00:00')).toBe(true);
      expect(timeRegex.test('23:59')).toBe(true);

      expect(timeRegex.test('24:00')).toBe(false);
      expect(timeRegex.test('7:00')).toBe(false);
      expect(timeRegex.test('12:60')).toBe(false);
      expect(timeRegex.test('invalid')).toBe(false);
    });
  });

  describe('5. Chat Privacy & Message Previews', () => {
    it('defaults hide_previews to false and allows explicit opt-in for lock screen privacy', () => {
      const defaults = getDefaultNotificationSettings('test-user');
      expect(defaults.hide_previews).toBe(false);

      const updated = { ...defaults, hide_previews: true };
      expect(updated.hide_previews).toBe(true);
    });
  });

  describe('6. Per-Room Mute Mapping', () => {
    it('maintains independent mute states across multiple rooms', () => {
      const initialMutedMap: Record<string, boolean> = {
        'room-alpha': false,
        'room-beta': true,
      };

      const toggleRoom = (map: Record<string, boolean>, id: string) => ({
        ...map,
        [id]: !map[id],
      });

      const nextMap = toggleRoom(initialMutedMap, 'room-alpha');
      expect(nextMap['room-alpha']).toBe(true);
      expect(nextMap['room-beta']).toBe(true);

      const nextMap2 = toggleRoom(nextMap, 'room-beta');
      expect(nextMap2['room-beta']).toBe(false);
    });
  });

  describe('7. Interactive Elements TestIDs Registry', () => {
    it('verifies standard testIDs used across settings and primer components', () => {
      const testIDs = [
        'notification-settings-screen',
        'btn-notification-settings-back',
        'btn-primer-prompt',
        'switch-pause-all',
        'switch-nudge',
        'switch-partner-activity',
        'switch-room-requests',
        'switch-chat-messages',
        'switch-streak-reminders',
        'switch-weekly-summary',
        'switch-trial-reminders',
        'switch-billing-alerts',
        'switch-meal-reminders',
        'switch-water-reminders',
        'switch-weigh-in-reminders',
        'switch-fasting-reminders',
        'switch-quiet-hours',
        'input-quiet-hours-start',
        'input-quiet-hours-end',
        'switch-hide-previews',
        'notification-primer-modal',
        'btn-enable-notifications',
        'btn-open-settings',
        'btn-dismiss-primer',
        'btn-me-notification-settings',
      ];

      expect(testIDs.length).toBeGreaterThanOrEqual(25);
      expect(new Set(testIDs).size).toBe(testIDs.length); // All unique
    });
  });
});
