import type {
  LocalReminderSchedule,
  NotificationSettings,
  NotificationType,
  PushPayload,
} from './types';

/**
 * Default notification settings following PRD 6.12, 6.20 & 7.1.
 */
export function getDefaultNotificationSettings(userId: string): NotificationSettings {
  return {
    user_id: userId,
    nudge_enabled: true,
    partner_activity_enabled: true,
    room_requests_enabled: true,
    chat_messages_enabled: true,
    streak_reminders_enabled: true,
    weekly_summary_enabled: true,
    trial_reminders_enabled: true,
    billing_alerts_enabled: true,
    meal_reminders_enabled: true,
    water_reminders_enabled: true,
    weigh_in_reminders_enabled: true,
    fasting_reminders_enabled: true,
    pause_all: false,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
    hide_previews: false,
    meal_times: {
      breakfast: '08:30',
      lunch: '13:00',
      dinner: '20:00',
    },
    water_interval_hours: 2,
    water_start_time: '08:00',
    water_end_time: '20:00',
    weigh_in_day_of_week: 1, // Monday
    weigh_in_time: '08:00',
  };
}

/**
 * Checks whether a given local time (HH:mm) falls within the quiet hours window.
 * Supports overnight quiet hours (e.g. 22:00 to 07:00).
 */
export function isQuietHours(timeStr: string, quietStart: string, quietEnd: string): boolean {
  if (!timeStr || !quietStart || !quietEnd) return false;
  if (quietStart === quietEnd) return false;

  const toMinutes = (t: string): number => {
    const parts = t.split(':');
    const h = parseInt(parts[0] ?? '0', 10);
    const m = parseInt(parts[1] ?? '0', 10);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };

  const current = toMinutes(timeStr);
  const start = toMinutes(quietStart);
  const end = toMinutes(quietEnd);

  if (start < end) {
    // Standard window during the same day (e.g. 13:00 to 15:00)
    return current >= start && current < end;
  } else {
    // Overnight window (e.g. 22:00 to 07:00)
    return current >= start || current < end;
  }
}

export interface NotificationDeliveryDecision {
  deliver: boolean;
  reason?: 'pause_all' | 'type_disabled' | 'room_chat_muted' | 'currently_viewing_chat' | 'quiet_hours';
}

/**
 * Determines whether a push notification should be delivered based on
 * user settings, quiet hours, room chat mute, and current viewing state.
 */
export function shouldDeliverNotification(options: {
  settings: NotificationSettings;
  type: NotificationType;
  roomChatMuted?: boolean;
  isViewingChat?: boolean;
  currentTimeLocal?: string; // HH:mm in user's timezone
}): NotificationDeliveryDecision {
  const { settings, type, roomChatMuted, isViewingChat, currentTimeLocal } = options;

  // 1. Single "pause all" switch
  if (settings.pause_all) {
    return { deliver: false, reason: 'pause_all' };
  }

  // 2. Per-type push toggles
  switch (type) {
    case 'nudge':
      if (!settings.nudge_enabled) return { deliver: false, reason: 'type_disabled' };
      break;
    case 'partner_workout':
    case 'partner_food':
      if (!settings.partner_activity_enabled) return { deliver: false, reason: 'type_disabled' };
      break;
    case 'room_invitation':
    case 'room_join_request':
    case 'room_request_accepted':
      if (!settings.room_requests_enabled) return { deliver: false, reason: 'type_disabled' };
      break;
    case 'chat_message':
      if (!settings.chat_messages_enabled) return { deliver: false, reason: 'type_disabled' };
      break;
    case 'streak_at_risk':
      if (!settings.streak_reminders_enabled) return { deliver: false, reason: 'type_disabled' };
      break;
    case 'weekly_summary':
      if (!settings.weekly_summary_enabled) return { deliver: false, reason: 'type_disabled' };
      break;
    case 'trial_ending':
      if (!settings.trial_reminders_enabled) return { deliver: false, reason: 'type_disabled' };
      break;
    case 'subscription_lapse':
    case 'room_state_change':
      if (!settings.billing_alerts_enabled) return { deliver: false, reason: 'type_disabled' };
      break;
    default:
      break;
  }

  // 3. Per-room chat mute
  if (type === 'chat_message' && roomChatMuted) {
    return { deliver: false, reason: 'room_chat_muted' };
  }

  // 4. Skip chat push if recipient is actively viewing the chat
  if (type === 'chat_message' && isViewingChat) {
    return { deliver: false, reason: 'currently_viewing_chat' };
  }

  // 5. Quiet hours check
  if (
    settings.quiet_hours_enabled &&
    currentTimeLocal &&
    isQuietHours(currentTimeLocal, settings.quiet_hours_start, settings.quiet_hours_end)
  ) {
    return { deliver: false, reason: 'quiet_hours' };
  }

  return { deliver: true };
}

/**
 * Sanitizes push payloads according to PRD 6.12 (NTF-3) and AGENT_RULES.md:
 * 1. Supportive tone, never shame.
 * 2. Never reveal another person's calorie numbers.
 * 3. Chat notifications respect hidePreviews setting.
 */
export function sanitizePushPayload(
  payload: PushPayload,
  hidePreviews = false,
): PushPayload {
  let body = payload.body;
  let title = payload.title;

  // PRD 6.12 NTF-3: Never include another person's calorie numbers in push notifications
  // Strip out any calorie representations (e.g. "650 kcal", "500 calories", "kcal: 600")
  body = body.replace(/\b\d+(\.\d+)?\s*(kcal|calories|cals)\b/gi, 'logged meal');

  // If hide_previews is enabled and this is a chat message, hide the message text
  if (hidePreviews && payload.data.type === 'chat_message') {
    title = payload.data.roomName ? String(payload.data.roomName) : 'New Message';
    body = 'New message received';
  }

  // Sanitize data payload: strip any raw nutritional/calorie keys that could have leaked
  const safeData: Record<string, unknown> = { ...payload.data };
  delete safeData.calories;
  delete safeData.macros;
  delete safeData.calories_kcal;
  delete safeData.protein_g;
  delete safeData.carbs_g;
  delete safeData.fat_g;
  delete safeData.weight_kg;

  return {
    title,
    body,
    data: safeData as PushPayload['data'],
  };
}

/**
 * Formats notification copy with a supportive tone (PRD 4, 6.12).
 */
export function formatNotificationCopy(
  type: NotificationType,
  params: {
    senderNickname?: string;
    roomName?: string;
    workoutTitle?: string;
    mealSection?: string;
    streakDays?: number;
    customMessage?: string;
    hidePreviews?: boolean;
  },
): { title: string; body: string } {
  const sender = params.senderNickname || 'Your partner';
  const room = params.roomName || 'your room';

  switch (type) {
    case 'nudge':
      return {
        title: `${sender} sent you a nudge`,
        body: params.customMessage || `${sender} is cheering you on today!`,
      };

    case 'partner_workout':
      return {
        title: `${sender} finished a workout!`,
        body: params.workoutTitle
          ? `${sender} completed: ${params.workoutTitle}`
          : `${sender} completed their workout today!`,
      };

    case 'partner_food':
      return {
        title: `${sender} logged a meal`,
        body: params.mealSection
          ? `${sender} logged ${params.mealSection}. Time for yours?`
          : `${sender} logged food in ${room}.`,
      };

    case 'room_invitation':
      return {
        title: 'Room Invitation',
        body: `${sender} invited you to join ${room}!`,
      };

    case 'room_join_request':
      return {
        title: 'Join Request',
        body: `${sender} requested to join ${room}.`,
      };

    case 'room_request_accepted':
      return {
        title: 'Request Accepted',
        body: `${sender} joined ${room}!`,
      };

    case 'chat_message':
      if (params.hidePreviews) {
        return {
          title: room,
          body: `New message from ${sender}`,
        };
      }
      return {
        title: `${sender} in ${room}`,
        body: params.customMessage
          ? params.customMessage.slice(0, 100)
          : 'New message',
      };

    case 'streak_at_risk':
      return {
        title: 'Keep your streak alive!',
        body: params.streakDays && params.streakDays > 1
          ? `You have a ${params.streakDays}-day streak! Log today before midnight to protect it.`
          : 'Don’t break the chain! Log your day before midnight.',
      };

    case 'weekly_summary':
      return {
        title: 'Your Weekly Summary is ready',
        body: 'Check out your consistency score and how your room did last week.',
      };

    case 'trial_ending':
      return {
        title: 'Room Trial Ending',
        body: params.customMessage || 'Keep your room and partner chat active by choosing a plan.',
      };

    case 'subscription_lapse':
      return {
        title: 'Subscription Alert',
        body: params.customMessage || 'There was an issue renewing your room plan. Tap to resolve.',
      };

    case 'room_state_change':
      return {
        title: 'Room Notice',
        body: params.customMessage || 'Your room status has changed.',
      };

    case 'focus_session':
      return {
        title: 'Focus Session',
        body: `${sender} started a shared focus session in ${room}. Join in!`,
      };

    default:
      return {
        title: 'CaliPartner',
        body: params.customMessage || 'You have a new update.',
      };
  }
}

/**
 * Validates basic FCM token string format.
 */
export function validateFcmToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  // Valid FCM tokens are base64-like alphanumeric strings usually >= 32 chars
  return trimmed.length >= 32 && /^[A-Za-z0-9_\-:]+$/.test(trimmed);
}

/**
 * Generates local reminder schedules based on user preferences.
 * Adheres to PRD 6.12 (NTF-1) & 6.20 (FST-6).
 */
export function buildLocalReminderSchedules(settings: NotificationSettings): LocalReminderSchedule[] {
  if (settings.pause_all) return [];

  const schedules: LocalReminderSchedule[] = [];

  // 1. Meal Reminders
  if (settings.meal_reminders_enabled && settings.meal_times) {
    const mealTitles: Record<string, string> = {
      breakfast: 'Breakfast reminder',
      lunch: 'Lunch reminder',
      dinner: 'Dinner reminder',
      snacks: 'Snack reminder',
    };

    for (const [section, time] of Object.entries(settings.meal_times)) {
      if (!time) continue;
      const parts = time.split(':');
      const h = parseInt(parts[0] ?? '0', 10);
      const m = parseInt(parts[1] ?? '0', 10);
      if (isNaN(h) || isNaN(m)) continue;

      schedules.push({
        id: `meal_reminder_${section}`,
        type: 'meal',
        title: mealTitles[section] || 'Meal reminder',
        body: `Time to log your ${section}! Track it in seconds.`,
        trigger: {
          hour: h,
          minute: m,
          repeats: true,
        },
        data: {
          section,
          url: '/today',
        },
      });
    }
  }

  // 2. Water Reminders
  if (
    settings.water_reminders_enabled &&
    settings.water_interval_hours > 0 &&
    settings.water_start_time &&
    settings.water_end_time
  ) {
    const startParts = settings.water_start_time.split(':');
    const endParts = settings.water_end_time.split(':');
    const startH = parseInt(startParts[0] ?? '8', 10);
    const endH = parseInt(endParts[0] ?? '20', 10);

    if (!isNaN(startH) && !isNaN(endH) && endH > startH) {
      for (let h = startH; h <= endH; h += settings.water_interval_hours) {
        schedules.push({
          id: `water_reminder_${h}`,
          type: 'water',
          title: 'Hydration check',
          body: 'Stay refreshed! Take a moment to log a glass of water.',
          trigger: {
            hour: h,
            minute: 0,
            repeats: true,
          },
          data: {
            url: '/today',
          },
        });
      }
    }
  }

  // 3. Weekly Weigh-in Reminder
  if (settings.weigh_in_reminders_enabled && settings.weigh_in_time) {
    const parts = settings.weigh_in_time.split(':');
    const h = parseInt(parts[0] ?? '8', 10);
    const m = parseInt(parts[1] ?? '0', 10);
    if (!isNaN(h) && !isNaN(m)) {
      schedules.push({
        id: 'weigh_in_reminder',
        type: 'weigh_in',
        title: 'Weekly weigh-in',
        body: 'Step on the scale and log your weight to keep your trend accurate.',
        trigger: {
          weekday: settings.weigh_in_day_of_week || 1, // 1 = Monday
          hour: h,
          minute: m,
          repeats: true,
        },
        data: {
          url: '/progress',
        },
      });
    }
  }

  return schedules;
}
