import * as Notifications from 'expo-notifications';
import { createLogger } from '@/lib/logger';
import { registerPushDevice } from './deviceService';

const log = createLogger('notificationPermissionService');

const PERMISSION_PROMPTED_KEY = 'calipartner_notif_prompted_moments';
let memoryPromptedMoments: Set<string> | null = null;

export type NotificationPromptContext =
  'room_joined' | 'reminder_configured' | 'nudge_sent' | 'settings_manual';

/**
 * Loads the set of moments for which permission has already been prompted.
 */
async function getPromptedMoments(): Promise<Set<string>> {
  if (memoryPromptedMoments) return memoryPromptedMoments;

  try {
    const { secureStoreAdapter } = await import('@/lib/secureStore');
    const raw = await secureStoreAdapter.getItem(PERMISSION_PROMPTED_KEY);
    if (raw) {
      memoryPromptedMoments = new Set(JSON.parse(raw));
      return memoryPromptedMoments;
    }
  } catch {
    // Fallback for test/web
  }

  memoryPromptedMoments = new Set<string>();
  return memoryPromptedMoments;
}

/**
 * Records that a prompt was shown for a specific context to prevent nagging (PRD 4, 6.23).
 */
async function markPromptedMoment(context: NotificationPromptContext): Promise<void> {
  const set = await getPromptedMoments();
  set.add(context);

  try {
    const { secureStoreAdapter } = await import('@/lib/secureStore');
    await secureStoreAdapter.setItem(PERMISSION_PROMPTED_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Fallback
  }
}

/**
 * Checks current notification permission status.
 */
export async function getNotificationPermissionStatus(): Promise<Notifications.PermissionStatus> {
  if (typeof Notifications.getPermissionsAsync !== 'function') {
    return Notifications.PermissionStatus.UNDETERMINED;
  }

  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch (err) {
    log.warn(`Error getting notification permissions: ${err}`);
    return Notifications.PermissionStatus.UNDETERMINED;
  }
}

/**
 * Evaluates whether we should prompt the user for notifications at this moment.
 * Enforces rule: "Permission request at a useful moment (not on first launch)".
 */
export async function shouldPromptForNotifications(
  context: NotificationPromptContext,
): Promise<boolean> {
  const status = await getNotificationPermissionStatus();
  if (status === Notifications.PermissionStatus.GRANTED) {
    return false; // Already granted
  }

  // If already denied permanently by OS, don't show custom primer unless in settings
  if (status === Notifications.PermissionStatus.DENIED && context !== 'settings_manual') {
    return false;
  }

  const prompted = await getPromptedMoments();
  if (prompted.has(context) && context !== 'settings_manual') {
    return false; // Already prompted in this contextual moment
  }

  return true;
}

/**
 * Requests native notification permissions from the OS.
 * If granted, obtains FCM token and registers device with Supabase.
 */
export async function requestNotificationPermissions(
  context: NotificationPromptContext = 'settings_manual',
): Promise<boolean> {
  await markPromptedMoment(context);

  if (typeof Notifications.requestPermissionsAsync !== 'function') {
    return false;
  }

  try {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    if (status !== Notifications.PermissionStatus.GRANTED) {
      log.info(`Notification permission denied or dismissed: ${status}`);
      return false;
    }

    log.info('Notification permission granted!');

    // Fetch device push token and register with Supabase
    try {
      if (typeof Notifications.getDevicePushTokenAsync === 'function') {
        const tokenResult = await Notifications.getDevicePushTokenAsync();
        if (tokenResult?.data) {
          await registerPushDevice(tokenResult.data);
        }
      }
    } catch (tokenErr) {
      log.warn(`Could not fetch device push token: ${tokenErr}`);
    }

    return true;
  } catch (err) {
    log.warn(`Error requesting notification permissions: ${err}`);
    return false;
  }
}
