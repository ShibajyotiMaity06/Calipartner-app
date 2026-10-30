import { describe, expect, it, vi } from 'vitest';
import { router } from 'expo-router';
import { handleNotificationResponse, resolveNotificationRoute } from './deepLinks';

vi.mock('expo-router', () => ({
  router: {
    push: vi.fn(),
  },
}));

vi.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync: vi.fn().mockResolvedValue(null),
  addNotificationResponseReceivedListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
}));

describe('deepLinks & Notification Routing', () => {
  it('routes retired activity notifications to Today instead of reopening deleted screens', () => {
    expect(resolveNotificationRoute({ type: 'focus_session', url: '/room' })).toBe('/(tabs)/today');
    expect(resolveNotificationRoute({ url: '/focus' })).toBe('/(tabs)/today');
    expect(resolveNotificationRoute({ url: '/(tabs)/focus?room=old' })).toBe('/(tabs)/today');
  });
  it('resolves explicit URL routes accurately', () => {
    expect(resolveNotificationRoute({ url: '/friends', kind: 'friend_request' })).toBe('/friends');
    expect(resolveNotificationRoute({ url: '/friends', kind: 'friend_accepted' })).toBe('/friends');
    expect(resolveNotificationRoute({ url: '/room' })).toBe('/(tabs)/room');
    expect(resolveNotificationRoute({ url: '/today' })).toBe('/(tabs)/today');
    expect(resolveNotificationRoute({ url: '/progress' })).toBe('/(tabs)/progress');
    expect(resolveNotificationRoute({ url: '/me' })).toBe('/(tabs)/me');
  });

  it('maps notification types to correct destinations', () => {
    expect(resolveNotificationRoute({ type: 'chat_message' })).toBe('/(tabs)/room');
    expect(resolveNotificationRoute({ type: 'nudge' })).toBe('/(tabs)/room');
    expect(resolveNotificationRoute({ type: 'partner_workout' })).toBe('/(tabs)/room');
    expect(resolveNotificationRoute({ type: 'partner_food' })).toBe('/(tabs)/room');
    expect(resolveNotificationRoute({ type: 'room_invitation' })).toBe('/(tabs)/room');
    expect(resolveNotificationRoute({ type: 'streak_at_risk' })).toBe('/(tabs)/today');
    expect(resolveNotificationRoute({ type: 'meal' })).toBe('/(tabs)/today');
    expect(resolveNotificationRoute({ type: 'water' })).toBe('/(tabs)/today');
    expect(resolveNotificationRoute({ type: 'weekly_summary' })).toBe('/(tabs)/progress');
    expect(resolveNotificationRoute({ type: 'weigh_in' })).toBe('/(tabs)/progress');
    expect(resolveNotificationRoute({ type: 'trial_ending' })).toBe('/(tabs)/me');
    expect(resolveNotificationRoute({ type: 'subscription_lapse' })).toBe('/(tabs)/me');
  });

  it('handles notification response and calls router.push', () => {
    const mockResponse = {
      notification: {
        request: {
          content: {
            data: {
              type: 'chat_message',
              roomId: 'room-123',
            },
          },
        },
      },
    };

    handleNotificationResponse(
      mockResponse as unknown as Parameters<typeof handleNotificationResponse>[0],
    );
    expect(router.push).toHaveBeenCalledWith('/(tabs)/room');
  });
});
