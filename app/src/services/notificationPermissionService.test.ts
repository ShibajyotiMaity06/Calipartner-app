import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Notifications from 'expo-notifications';
import {
  getNotificationPermissionStatus,
  requestNotificationPermissions,
  shouldPromptForNotifications,
} from './notificationPermissionService';
import * as deviceService from './deviceService';

vi.mock('expo-notifications', () => ({
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: 'undetermined' }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
  getDevicePushTokenAsync: vi.fn().mockResolvedValue({ data: 'mock-fcm-token-1234567890abcdef123' }),
  PermissionStatus: {
    UNDETERMINED: 'undetermined',
    GRANTED: 'granted',
    DENIED: 'denied',
  },
}));

vi.mock('./deviceService', () => ({
  registerPushDevice: vi.fn().mockResolvedValue('device-id-123'),
}));

vi.mock('@/lib/secureStore', () => ({
  secureStoreAdapter: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('notificationPermissionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks notification permission status', async () => {
    const status = await getNotificationPermissionStatus();
    expect(status).toBe(Notifications.PermissionStatus.UNDETERMINED);
  });

  it('prompts at a useful moment and avoids re-prompting once prompted', async () => {
    const shouldPromptFirst = await shouldPromptForNotifications('room_joined');
    expect(shouldPromptFirst).toBe(true);

    // Request permissions for that context
    const granted = await requestNotificationPermissions('room_joined');
    expect(granted).toBe(true);
    expect(deviceService.registerPushDevice).toHaveBeenCalledWith(
      'mock-fcm-token-1234567890abcdef123',
    );
  });
});
