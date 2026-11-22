import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Modal: 'Modal',
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'ios' },
  Linking: { openURL: vi.fn(), openSettings: vi.fn() },
  StyleSheet: { create: (x: unknown) => x },
}));

vi.mock('expo-notifications', () => ({
  PermissionStatus: {
    UNDETERMINED: 'undetermined',
    GRANTED: 'granted',
    DENIED: 'denied',
  },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: 'Icon',
}));

vi.mock('@calipartner/ui', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    Button: 'Button',
    Text: 'Text',
    useReduceTransparency: vi.fn().mockReturnValue(false),
  };
});

vi.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#1c1c1e',
      surfaceAlt: '#2c2c2e',
      border: '#38383a',
      accent: '#FF7043',
      text: '#ffffff',
      textMuted: '#8e8e93',
      waterInk: '#4FC3F7',
      onAccent: '#1c1109',
    },
  }),
}));

vi.mock('@/services/notificationPermissionService', () => ({
  getNotificationPermissionStatus: vi.fn().mockResolvedValue('undetermined'),
  requestNotificationPermissions: vi.fn().mockResolvedValue(true),
}));

import { NotificationPrimerModal } from './NotificationPrimerModal';
import { requestNotificationPermissions } from '@/services/notificationPermissionService';

describe('NotificationPrimerModal Glass & Permissions', () => {
  let tree: ReactTestRenderer;

  afterEach(async () => {
    if (tree) await act(async () => tree.unmount());
  });

  it('renders with glass effect styles when isGlass is true', async () => {
    await act(async () => {
      tree = create(<NotificationPrimerModal visible={true} isGlass={true} onDismiss={vi.fn()} />);
    });

    const root = tree.toJSON();
    const str = JSON.stringify(root);
    expect(str).toContain('notification-primer-modal');
    expect(str).toContain('Stay Accountable with Reminders');
  });

  it('requests notification permissions when enable button is pressed', async () => {
    const onGranted = vi.fn();
    const onDismiss = vi.fn();

    await act(async () => {
      tree = create(
        <NotificationPrimerModal
          visible={true}
          isGlass={true}
          onGranted={onGranted}
          onDismiss={onDismiss}
        />,
      );
    });

    const enableBtn = tree.root.findByProps({ testID: 'btn-enable-notifications' });
    await act(async () => {
      enableBtn.props.onPress();
    });

    expect(requestNotificationPermissions).toHaveBeenCalledWith('settings_manual');
    expect(onGranted).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });
});
