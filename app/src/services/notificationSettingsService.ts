import { getSupabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';
import { getDefaultNotificationSettings, type NotificationSettings } from '@calipartner/core';

const log = createLogger('notificationSettingsService');

let cachedSettings: NotificationSettings | null = null;

/**
 * Fetches the user's notification settings from Supabase.
 * Returns defaults if unauthenticated or on error.
 */
export async function getNotificationSettings(forceRefresh = false): Promise<NotificationSettings> {
  if (cachedSettings && !forceRefresh) {
    return cachedSettings;
  }

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return getDefaultNotificationSettings('guest');
  }

  try {
    const { data, error } = await supabase.rpc('get_or_create_notification_settings', {
      p_user_id: user.id,
    });

    if (error) {
      log.warn(`Error getting notification settings: ${error.message}`);
      return getDefaultNotificationSettings(user.id);
    }

    cachedSettings = data as NotificationSettings;
    return cachedSettings;
  } catch (err) {
    log.warn(`Exception getting notification settings: ${err}`);
    return getDefaultNotificationSettings(user.id);
  }
}

/**
 * Updates the user's notification settings in Supabase.
 */
export async function updateNotificationSettings(
  updates: Partial<NotificationSettings>,
): Promise<NotificationSettings | null> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  try {
    const { data, error } = await supabase
      .from('notification_settings')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      log.warn(`Error updating notification settings: ${error.message}`);
      return null;
    }

    cachedSettings = data as NotificationSettings;
    return cachedSettings;
  } catch (err) {
    log.warn(`Exception updating notification settings: ${err}`);
    return null;
  }
}

/**
 * Sets chat mute status for a specific room (PRD 6.12 NTF-2).
 */
export async function setRoomChatMute(roomId: string, muted: boolean): Promise<boolean> {
  const supabase = getSupabase();
  try {
    const { error } = await supabase.rpc('set_room_chat_mute', {
      p_room_id: roomId,
      p_muted: muted,
    });

    if (error) {
      log.warn(`Error setting room chat mute: ${error.message}`);
      return false;
    }

    return true;
  } catch (err) {
    log.warn(`Exception setting room chat mute: ${err}`);
    return false;
  }
}

/**
 * Checks whether chat is muted for a specific room.
 */
export async function isRoomChatMuted(roomId: string): Promise<boolean> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  try {
    const { data, error } = await supabase.rpc('is_room_chat_muted', {
      p_room_id: roomId,
      p_user_id: user.id,
    });

    if (error) {
      return false;
    }

    return Boolean(data);
  } catch {
    return false;
  }
}

/**
 * Clears in-memory settings cache (e.g. on sign out).
 */
export function clearNotificationSettingsCache(): void {
  cachedSettings = null;
}
