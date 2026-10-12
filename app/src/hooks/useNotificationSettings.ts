import { useCallback, useEffect, useState } from 'react';
import type { NotificationSettings } from '@calipartner/core';
import {
  getNotificationSettings,
  setRoomChatMute,
  updateNotificationSettings,
} from '@/services/notificationSettingsService';
import { syncAllLocalReminders } from '@/services/localNotificationService';

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async (force = false) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getNotificationSettings(force);
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const update = useCallback(
    async (updates: Partial<NotificationSettings>) => {
      if (!settings) return null;
      try {
        setError(null);
        // Optimistic update
        const optimistic = { ...settings, ...updates };
        setSettings(optimistic);

        const saved = await updateNotificationSettings(updates);
        if (saved) {
          setSettings(saved);
          // Reschedule local reminders to reflect changes
          await syncAllLocalReminders(saved);
          return saved;
        } else {
          // Revert on failure
          setSettings(settings);
          setError('Failed to save notification settings');
          return null;
        }
      } catch (err) {
        setSettings(settings);
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [settings],
  );

  const muteRoomChat = useCallback(async (roomId: string, muted: boolean) => {
    return await setRoomChatMute(roomId, muted);
  }, []);

  return {
    settings,
    isLoading,
    error,
    updateSettings: update,
    muteRoomChat,
    refresh: () => loadSettings(true),
  };
}
