import React from 'react';
import { useRouter } from 'expo-router';
import { NotificationSettingsScreen } from '@/components/notifications';

export default function NotificationSettingsRoute() {
  const router = useRouter();

  return (
    <NotificationSettingsScreen
      onBack={() => router.back()}
      testID="notification-settings-route"
    />
  );
}
