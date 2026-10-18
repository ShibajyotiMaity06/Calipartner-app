import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDefaultNotificationSettings } from '@calipartner/core';
import {
  clearNotificationSettingsCache,
  getNotificationSettings,
  isRoomChatMuted,
  setRoomChatMute,
  updateNotificationSettings,
} from './notificationSettingsService';
import * as supabaseLib from '@/lib/supabase';

vi.mock('@/lib/supabase');

describe('notificationSettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearNotificationSettingsCache();
  });

  it('fetches notification settings via RPC get_or_create_notification_settings', async () => {
    const mockSettings = {
      ...getDefaultNotificationSettings('user-1'),
      quiet_hours_enabled: true,
      quiet_hours_start: '23:00',
    };

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      rpc: vi.fn().mockResolvedValue({
        data: mockSettings,
        error: null,
      }),
    };

    vi.spyOn(supabaseLib, 'getSupabase').mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof supabaseLib.getSupabase>,
    );

    const result = await getNotificationSettings();
    expect(result.user_id).toBe('user-1');
    expect(result.quiet_hours_enabled).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_or_create_notification_settings', {
      p_user_id: 'user-1',
    });
  });

  it('returns default settings when user is unauthenticated', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    };

    vi.spyOn(supabaseLib, 'getSupabase').mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof supabaseLib.getSupabase>,
    );

    const result = await getNotificationSettings();
    expect(result.user_id).toBe('guest');
    expect(result.nudge_enabled).toBe(true);
  });

  it('updates notification settings in database', async () => {
    const updated = {
      ...getDefaultNotificationSettings('user-1'),
      hide_previews: true,
    };

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: updated,
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    vi.spyOn(supabaseLib, 'getSupabase').mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof supabaseLib.getSupabase>,
    );

    const result = await updateNotificationSettings({ hide_previews: true });
    expect(result).not.toBeNull();
    expect(result?.hide_previews).toBe(true);
  });

  it('sets and checks room chat mute', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      rpc: vi.fn().mockImplementation((fn: string) => {
        if (fn === 'set_room_chat_mute') {
          return Promise.resolve({ data: null, error: null });
        }
        if (fn === 'is_room_chat_muted') {
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };

    vi.spyOn(supabaseLib, 'getSupabase').mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof supabaseLib.getSupabase>,
    );

    const setResult = await setRoomChatMute('room-1', true);
    expect(setResult).toBe(true);

    const isMuted = await isRoomChatMuted('room-1');
    expect(isMuted).toBe(true);
  });
});
