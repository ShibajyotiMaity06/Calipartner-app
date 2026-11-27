import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  deleteAccount: vi.fn().mockResolvedValue({ error: null }),
  updateEmail: vi.fn().mockResolvedValue({ error: null }),
  updatePassword: vi.fn().mockResolvedValue({ error: null }),
  resetPassword: vi.fn().mockResolvedValue({ error: null }),
  permissionStatus: 'granted' as 'granted' | 'not_requested',
  tier: 'free' as 'free' | 'plus' | 'pro',
}));

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'RNText',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: <T,>(v: T) => v },
  useWindowDimensions: () => ({ fontScale: 1 }),
}));

vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.0' } },
}));

vi.mock('expo-notifications', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    useRouter: () => ({
      push: state.push,
      replace: state.replace,
      back: state.back,
      canGoBack: () => true,
    }),
    useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
  };
});

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('@calipartner/ui', () => ({
  getTabBarHeight: () => 64,
}));

vi.mock('@calipartner/ui/v1', () => ({
  Text: 'Text',
  Badge: 'Badge',
  BellIcon: 'BellIcon',
  ChartBarIcon: 'ChartBarIcon',
  ChevronLeftIcon: 'ChevronLeftIcon',
  ChevronRightIcon: 'ChevronRightIcon',
  CloseIcon: 'CloseIcon',
  CreditCardIcon: 'CreditCardIcon',
  EnvelopeIcon: 'EnvelopeIcon',
  EyeIcon: 'EyeIcon',
  FlagIcon: 'FlagIcon',
  HeartIcon: 'HeartIcon',
  IconButton: 'IconButton',
  InfoCircleIcon: 'InfoCircleIcon',
  KeyIcon: 'KeyIcon',
  PrimaryButton: 'PrimaryButton',
  ProfileIcon: 'ProfileIcon',
  PulseIcon: 'PulseIcon',
  QuestionCircleIcon: 'QuestionCircleIcon',
  RulerIcon: 'RulerIcon',
  ScaleIcon: 'ScaleIcon',
  SearchIcon: 'SearchIcon',
  SecondaryButton: 'SecondaryButton',
  Sheet: ({
    visible,
    testID,
    children,
  }: {
    visible?: boolean;
    testID?: string;
    children?: React.ReactNode;
  }) => (visible ? React.createElement('View', { testID }, children) : null),
  Input: 'Input',
  CheckCircleIcon: 'CheckCircleIcon',
  SignOutIcon: 'SignOutIcon',
  SlidersIcon: 'SlidersIcon',
  StarIcon: 'StarIcon',
  TrashIcon: 'TrashIcon',
  UsersIcon: 'UsersIcon',
  borders: { width: 1 },
  colors: {
    bg0: '#0E0B08',
    s1: '#1A1511',
    s2: '#241E18',
    hairline: '#3A3228',
    textHi: '#F7F0E7',
    textMid: '#C9BCAC',
    textLo: '#9A8E7F',
    apricot: '#F4B67D',
    danger: '#F65C58',
  },
  fonts: { regular: 'Manrope', medium: 'Manrope', semibold: 'Manrope', bold: 'Manrope' },
  layout: { screenPaddingX: 24, minTouchTarget: 44 },
  radius: { chip: 16, card: 22, full: 999 },
  space: { xs: 4, sm: 8, md: 12, optical14: 14, lg: 16, xl: 20 },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'u1',
      email: 'priya@email.com',
      identities: [{ provider: 'apple' }, { provider: 'google' }],
      app_metadata: { providers: ['apple', 'google'] },
    },
    profile: {
      id: 'u1',
      units: 'metric',
      height_cm: 168,
      sex: 'female',
      date_of_birth: '1999-05-01',
      discoverable: false,
    },
    signOut: state.signOut,
    deleteAccount: state.deleteAccount,
    updateProfile: vi.fn().mockResolvedValue({ error: null }),
    updateEmail: state.updateEmail,
    updatePassword: state.updatePassword,
    resetPassword: state.resetPassword,
  }),
}));

vi.mock('@/hooks/useTargets', () => ({
  useTargets: () => ({
    currentGoalProfile: {
      goal: 'cut',
      weekly_rate_kg: 0.5,
      current_weight_kg: 73.5,
      step_goal: 10000,
      water_ml_goal: 3000,
      protein_grams: 140,
      carb_grams: 210,
      fat_grams: 55,
    },
    calculate: vi.fn(),
    saveGoalProfile: vi.fn(),
    updateDailyGoals: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/hooks/useWeight', () => ({
  useWeight: () => ({ latestLog: { weight_kg: 73.5 } }),
}));

vi.mock('@/hooks/useTrackingPreferences', () => ({
  useTrackingPreferences: () => ({
    enabled: { calories: true, protein: true, carbs: true, fat: true, steps: true, water: false },
    save: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/hooks/useSteps', () => ({
  useSteps: () => ({
    permissionStatus: state.permissionStatus,
    activity: null,
    requestPermission: vi.fn().mockResolvedValue(true),
    syncFromPlatform: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/hooks/useRooms', () => ({
  useRooms: () => ({ rooms: [{ id: 'r1' }, { id: 'r2' }] }),
}));

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ currentTier: state.tier, isTrial: false }),
}));

vi.mock('@/services/nativeHealthService', () => ({ disconnectNativeHealth: vi.fn() }));
vi.mock('@/services/notificationPermissionService', () => ({
  getNotificationPermissionStatus: vi.fn().mockResolvedValue('granted'),
}));
vi.mock('@/services/notificationSettingsService', () => ({
  getNotificationSettings: vi.fn().mockResolvedValue({ meal_reminders: true }),
}));
vi.mock('@/services/storeReviewService', () => ({
  requestStoreReview: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => 'uuid-1' }));

vi.mock('@/components/profile/AboutLegalModal', () => ({ AboutLegalModal: 'AboutLegalModal' }));
vi.mock('@/components/profile/CustomMacrosModal', () => ({
  CustomMacrosModal: 'CustomMacrosModal',
}));
vi.mock('@/components/profile/DailyGoalsModal', () => ({ DailyGoalsModal: 'DailyGoalsModal' }));
vi.mock('@/components/profile/DeleteAccountModal', () => ({
  DeleteAccountModal: 'DeleteAccountModal',
}));
vi.mock('@/components/profile/DiscoverabilityModal', () => ({
  DiscoverabilityModal: 'DiscoverabilityModal',
}));
vi.mock('@/components/profile/GoalsAndBodyModal', () => ({
  GoalsAndBodyModal: 'GoalsAndBodyModal',
}));
vi.mock('@/components/profile/HealthSyncModal', () => ({ HealthSyncModal: 'HealthSyncModal' }));
vi.mock('@/components/profile/HelpCentreModal', () => ({ HelpCentreModal: 'HelpCentreModal' }));
vi.mock('@/components/profile/PerRoomVisibilityModal', () => ({
  PerRoomVisibilityModal: 'PerRoomVisibilityModal',
}));
vi.mock('@/components/profile/ReportFeedbackModal', () => ({
  ReportFeedbackModal: 'ReportFeedbackModal',
}));
vi.mock('@/components/profile/SignOutSheet', () => ({ SignOutSheet: 'SignOutSheet' }));
vi.mock('@/components/profile/UnitsLanguageModal', () => ({
  UnitsLanguageModal: 'UnitsLanguageModal',
}));
vi.mock('@/components/rooms/TrackingPreferencesSheet', () => ({
  TrackingPreferencesSheet: 'TrackingPreferencesSheet',
}));

import { SettingsScreenV1 } from '@/components/profile/SettingsScreenV1';

let tree: ReactTestRenderer | undefined;

describe('SettingsScreenV1', () => {
  beforeEach(() => {
    state.tier = 'free';
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (tree) {
      await act(async () => {
        tree?.unmount();
      });
      tree = undefined;
    }
  });

  it('renders all 5 settings groups and destructive actions', async () => {
    await act(async () => {
      tree = create(<SettingsScreenV1 />);
    });

    expect(tree!.root.findByProps({ testID: 'settings-row-goals-body' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'settings-row-daily-targets' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'settings-row-custom-macros' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'settings-row-customize-day' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'settings-row-units' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'settings-row-notifications' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'settings-row-health-sync' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'settings-row-squad-visibility' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'settings-row-discoverability' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'settings-row-social-profile' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'settings-row-plan' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'settings-row-email' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'settings-row-password' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'settings-row-methods' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'btn-sign-out' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'btn-delete-account' })).toBeDefined();

    await act(async () => {
      tree!.root.findByProps({ testID: 'settings-row-custom-macros' }).props.onPress();
    });
    expect(state.push).toHaveBeenCalledWith('/paywall');

    await act(async () => {
      tree!.root.findByProps({ testID: 'settings-row-email' }).props.onPress();
    });
    expect(tree!.root.findByProps({ testID: 'sheet-settings-email' })).toBeDefined();
  });
});
