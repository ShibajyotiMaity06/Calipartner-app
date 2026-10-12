import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Notifications from 'expo-notifications';
import { getDefaultNotificationSettings } from '@calipartner/core';
import {
  cancelAllLocalReminders,
  cancelFastingReminder,
  scheduleFastingReminder,
  syncAllLocalReminders,
} from './localNotificationService';

vi.mock('expo-notifications', () => ({
  scheduleNotificationAsync: vi.fn().mockResolvedValue('notif-id-123'),
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(undefined),
  cancelAllScheduledNotificationsAsync: vi.fn().mockResolvedValue(undefined),
  setNotificationHandler: vi.fn(),
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    TIME_INTERVAL: 'timeInterval',
    DATE: 'date',
  },
}));

describe('localNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('syncs all local reminders for meals, water, and weekly weigh-in', async () => {
    const settings = getDefaultNotificationSettings('user-1');
    const result = await syncAllLocalReminders(settings);

    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    expect(result.scheduled).toBeGreaterThan(0);
    expect(result.cancelled).toBe(true);
  });

  it('cancels all reminders and schedules none when pause_all is true', async () => {
    const settings = {
      ...getDefaultNotificationSettings('user-1'),
      pause_all: true,
    };

    const result = await syncAllLocalReminders(settings);
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    expect(result.scheduled).toBe(0);
    expect(result.cancelled).toBe(true);
  });

  it('schedules fasting reminder when date is in the future', async () => {
    const futureDate = new Date(Date.now() + 3600 * 1000); // 1 hour in future
    const id = await scheduleFastingReminder({
      id: 'fast_1',
      type: 'fast_start',
      targetDate: futureDate,
      protocolName: '16:8',
    });

    expect(id).toBe('notif-id-123');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'fast_1',
        content: expect.objectContaining({
          title: 'Fast starting',
        }),
      }),
    );
  });

  it('cancels specific fasting reminder', async () => {
    await cancelFastingReminder('fast_1');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('fast_1');
  });

  it('cancels all local reminders', async () => {
    await cancelAllLocalReminders();
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
  });
});
