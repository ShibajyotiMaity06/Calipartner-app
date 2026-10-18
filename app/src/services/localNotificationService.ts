import * as Notifications from 'expo-notifications';
import { createLogger } from '@/lib/logger';
import {
  buildFastingReminderSchedules,
  buildLocalReminderSchedules,
  isQuietHours,
  type FastingSession,
  type FastingSettings,
  type LocalReminderSchedule,
  type NotificationSettings,
} from '@calipartner/core';

const log = createLogger('localNotificationService');

// Configure global notification presentation behavior
try {
  if (typeof Notifications.setNotificationHandler === 'function') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch {
  // Ignored in test environment
}

/**
 * Checks if local notifications are supported in the current environment.
 */
export function isLocalNotificationSupported(): boolean {
  return typeof Notifications.scheduleNotificationAsync === 'function';
}

/**
 * Synchronizes all local reminders (meals, water, weigh-in) according to user settings.
 * Complies with PRD 6.12 (NTF-1) & 6.20 (FST-6).
 */
export async function syncAllLocalReminders(
  settings: NotificationSettings,
): Promise<{ scheduled: number; cancelled: boolean }> {
  if (!isLocalNotificationSupported()) {
    log.info('Local notifications not supported or running in web/test environment');
    return { scheduled: 0, cancelled: false };
  }

  try {
    // 1. Cancel existing scheduled local notifications
    await cancelAllLocalReminders();

    // If pause_all is active, stop here
    if (settings.pause_all) {
      log.info('Pause all is enabled, no reminders scheduled');
      return { scheduled: 0, cancelled: true };
    }

    // 2. Build reminder schedules from pure core calculator
    const schedules = buildLocalReminderSchedules(settings);
    let count = 0;

    for (const schedule of schedules) {
      // Check quiet hours: if schedule trigger time falls inside quiet hours, skip or adjust
      if (
        settings.quiet_hours_enabled &&
        schedule.trigger.hour !== undefined &&
        schedule.trigger.minute !== undefined
      ) {
        const timeStr = `${String(schedule.trigger.hour).padStart(2, '0')}:${String(
          schedule.trigger.minute,
        ).padStart(2, '0')}`;
        if (isQuietHours(timeStr, settings.quiet_hours_start, settings.quiet_hours_end)) {
          log.info(`Skipping schedule ${schedule.id} because it falls within quiet hours`);
          continue;
        }
      }

      await scheduleSingleReminder(schedule);
      count++;
    }

    log.info(`Successfully scheduled ${count} local reminders`);
    return { scheduled: count, cancelled: true };
  } catch (err) {
    log.warn(`Error synchronizing local reminders: ${err}`);
    return { scheduled: 0, cancelled: false };
  }
}

/**
 * Schedules a single reminder with expo-notifications.
 */
export async function scheduleSingleReminder(
  schedule: LocalReminderSchedule,
): Promise<string | null> {
  if (!isLocalNotificationSupported()) return null;

  try {
    let trigger: Notifications.NotificationTriggerInput;

    if (schedule.trigger.weekday !== undefined) {
      // Weekly trigger (e.g. weigh-in on Monday)
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: schedule.trigger.weekday,
        hour: schedule.trigger.hour ?? 8,
        minute: schedule.trigger.minute ?? 0,
      };
    } else if (schedule.trigger.hour !== undefined && schedule.trigger.minute !== undefined) {
      // Daily trigger (e.g. meal reminder at 13:00)
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: schedule.trigger.hour,
        minute: schedule.trigger.minute,
      };
    } else if (schedule.trigger.seconds !== undefined) {
      // Time interval trigger
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: schedule.trigger.seconds,
        repeats: schedule.trigger.repeats ?? false,
      };
    } else {
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 60,
        repeats: false,
      };
    }

    const id = await Notifications.scheduleNotificationAsync({
      identifier: schedule.id,
      content: {
        title: schedule.title,
        body: schedule.body,
        data: schedule.data || {},
        sound: 'default',
      },
      trigger,
    });

    return id;
  } catch (err) {
    log.warn(`Failed to schedule reminder ${schedule.id}: ${err}`);
    return null;
  }
}

/**
 * Fasting reminder plug-in interface (PRD 6.20 FST-6).
 * Plugs directly into the local notification service for Phase 13.
 */
export async function scheduleFastingReminder(options: {
  id: string;
  type: 'fast_start' | 'fast_end' | 'window_closing';
  targetDate: Date;
  protocolName?: string;
  quietHoursSettings?: {
    enabled: boolean;
    start: string;
    end: string;
  };
}): Promise<string | null> {
  if (!isLocalNotificationSupported()) return null;

  const { id, type, targetDate, protocolName, quietHoursSettings } = options;
  const now = Date.now();
  const diffSeconds = Math.floor((targetDate.getTime() - now) / 1000);

  if (diffSeconds <= 0) {
    log.warn('Fasting reminder target date is in the past, skipping');
    return null;
  }

  // Check quiet hours
  if (quietHoursSettings?.enabled) {
    const hours = String(targetDate.getHours()).padStart(2, '0');
    const minutes = String(targetDate.getMinutes()).padStart(2, '0');
    if (isQuietHours(`${hours}:${minutes}`, quietHoursSettings.start, quietHoursSettings.end)) {
      log.info(`Fasting reminder ${id} suppressed due to quiet hours`);
      return null;
    }
  }

  let title = 'Fasting reminder';
  let body = 'Update on your fasting window.';

  if (type === 'fast_start') {
    title = 'Fast starting';
    body = protocolName
      ? `Your ${protocolName} fast is beginning. Stay hydrated!`
      : 'Your fast is starting. Drink plenty of water!';
  } else if (type === 'fast_end') {
    title = 'Fast completed!';
    body = 'You’ve reached your fasting target. Break your fast gently.';
  } else if (type === 'window_closing') {
    title = 'Eating window closing soon';
    body = '30 minutes left in your eating window.';
  }

  try {
    return await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title,
        body,
        data: {
          type: 'fasting',
          fastingType: type,
          url: '/today',
        },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: targetDate,
      },
    });
  } catch (err) {
    log.warn(`Failed to schedule fasting reminder ${id}: ${err}`);
    return null;
  }
}

/**
 * Cancels fasting reminders.
 */
export async function cancelFastingReminder(id: string): Promise<void> {
  if (!isLocalNotificationSupported()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (err) {
    log.warn(`Error cancelling fasting reminder ${id}: ${err}`);
  }
}

/**
 * Reschedules all fasting reminders for settings and active fast (PRD 6.20 FST-6).
 * Cancels old fasting reminders and schedules updated ones.
 */
export async function rescheduleAllFastingReminders(params: {
  settings: FastingSettings;
  activeSession?: FastingSession | null;
  quietHoursSettings?: {
    enabled: boolean;
    start: string;
    end: string;
  };
  referenceTime?: Date;
}): Promise<number> {
  if (!isLocalNotificationSupported()) return 0;
  const { settings, activeSession, quietHoursSettings, referenceTime } = params;

  try {
    // 1. Cancel previous fasting reminders
    await cancelFastingReminder('fasting_eating_window_closing');
    if (activeSession) {
      await cancelFastingReminder(`fasting_end_${activeSession.id}`);
    }

    if (!settings.enabled) return 0;

    // 2. Build schedules using pure core calculator
    const schedules = buildFastingReminderSchedules({
      settings,
      activeSession,
      quietHoursSettings,
      referenceTime,
    });

    let scheduledCount = 0;
    for (const schedule of schedules) {
      const id = await scheduleSingleReminder(schedule);
      if (id) scheduledCount++;
    }

    log.info(`Rescheduled ${scheduledCount} fasting reminders`);
    return scheduledCount;
  } catch (err) {
    log.warn(`Error rescheduling fasting reminders: ${err}`);
    return 0;
  }
}

/**
 * Cancels all scheduled local notifications.
 */
export async function cancelAllLocalReminders(): Promise<void> {
  if (!isLocalNotificationSupported()) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    log.info('Cancelled all scheduled local notifications');
  } catch (err) {
    log.warn(`Error cancelling local notifications: ${err}`);
  }
}

/**
 * Schedules a local notification at timer end (PRD FOC-3).
 */
export async function scheduleFocusTimerEndReminder(params: {
  sessionId: string;
  seconds: number;
  label?: string | null;
}): Promise<string | null> {
  if (!isLocalNotificationSupported() || params.seconds <= 0) return null;
  const targetDate = new Date(Date.now() + params.seconds * 1000);
  const notifId = `focus_timer_end_${params.sessionId}`;
  try {
    return await Notifications.scheduleNotificationAsync({
      identifier: notifId,
      content: {
        title: 'Focus Timer Ended',
        body: params.label
          ? `Great work! Your "${params.label}" focus session has finished.`
          : 'Great work! Your focus session has finished.',
        data: {
          type: 'focus_session',
          sessionId: params.sessionId,
          url: '/(tabs)/room',
        },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: targetDate,
      },
    });
  } catch (err) {
    log.warn(`Failed to schedule focus timer end notification: ${err}`);
    return null;
  }
}

/**
 * Cancels focus timer local notification when session is ended, left, or paused.
 */
export async function cancelFocusTimerEndReminder(sessionId: string): Promise<void> {
  if (!isLocalNotificationSupported()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(`focus_timer_end_${sessionId}`);
  } catch (err) {
    log.warn(`Error cancelling focus timer reminder: ${err}`);
  }
}
