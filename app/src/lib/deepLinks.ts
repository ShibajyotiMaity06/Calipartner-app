import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { createLogger } from '@/lib/logger';
import type { NotificationType } from '@calipartner/core';

const log = createLogger('deepLinks');

export interface NotificationDeepLinkData {
  type?: NotificationType | string;
  url?: string;
  roomId?: string;
  messageId?: string;
  workoutId?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Resolves an Expo Router path from notification payload data.
 */
export function resolveNotificationRoute(data?: NotificationDeepLinkData): string {
  if (!data) return '/(tabs)/today';
  // Old delivered notifications must not reopen the retired feature.
  if (data.type === 'focus_session' || /^\/(?:\(tabs\)\/)?focus(?:[/?#]|$)/.test(data.url ?? ''))
    return '/(tabs)/today';

  // Explicit URL provided in payload
  if (data.url && typeof data.url === 'string') {
    if (data.url.startsWith('/(tabs)/')) return data.url;
    if (data.url === '/room') return '/(tabs)/room';
    if (data.url === '/today') return '/(tabs)/today';
    if (data.url === '/progress') return '/(tabs)/progress';
    if (data.url === '/me') return '/(tabs)/me';
    if (data.url === '/log') return '/(tabs)/log';
    return data.url;
  }

  // Type-based fallback mapping
  switch (data.type) {
    case 'chat_message':
    case 'nudge':
    case 'partner_workout':
    case 'partner_food':
    case 'room_invitation':
    case 'room_join_request':
    case 'room_request_accepted':
    case 'room_state_change':
      return '/(tabs)/room';

    case 'meal':
    case 'water':
    case 'streak_at_risk':
    case 'fasting':
      return '/(tabs)/today';

    case 'weekly_summary':
    case 'weigh_in':
      return '/(tabs)/progress';

    case 'trial_ending':
    case 'subscription_lapse':
      return '/(tabs)/me';

    default:
      return '/(tabs)/today';
  }
}

/**
 * Handles navigation when user interacts with / taps a notification.
 */
export function handleNotificationResponse(response: Notifications.NotificationResponse): void {
  try {
    const data = response.notification.request.content.data as NotificationDeepLinkData;
    const targetRoute = resolveNotificationRoute(data);
    log.info(`Navigating to ${targetRoute} from notification response`);
    router.push(targetRoute as Parameters<typeof router.push>[0]);
  } catch (err) {
    log.warn(`Failed to navigate from notification: ${err}`);
  }
}

/**
 * Initializes notification interaction listeners for deep linking.
 * Returns an unsubscribe cleanup function.
 */
export function setupNotificationListeners(): () => void {
  if (
    Platform.OS === 'web' ||
    typeof Notifications.addNotificationResponseReceivedListener !== 'function'
  ) {
    return () => {};
  }

  try {
    // 1. Check if app was opened via a notification response
    Notifications.getLastNotificationResponseAsync().then((lastResponse) => {
      if (lastResponse) {
        handleNotificationResponse(lastResponse);
      }
    });

    // 2. Listen for interactions while app is active or in background
    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );

    return () => {
      subscription.remove();
    };
  } catch (err) {
    log.warn(`Error setting up notification listeners: ${err}`);
    return () => {};
  }
}
