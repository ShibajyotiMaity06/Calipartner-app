import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoalProfile, NotificationSettings, RoomPrivacySettings } from '@calipartner/core';

const state = vi.hoisted(() => ({
  back: vi.fn(),
  notifSettings: {
    user_id: 'u1',
    nudge_enabled: true,
    partner_activity_enabled: true,
    room_requests_enabled: true,
    chat_messages_enabled: true,
    streak_reminders_enabled: true,
    weekly_summary_enabled: true,
    trial_reminders_enabled: true,
    billing_alerts_enabled: true,
    meal_reminders_enabled: true,
    water_reminders_enabled: true,
    weigh_in_reminders_enabled: true,
    fasting_reminders_enabled: true,
    pause_all: false,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
    hide_previews: false,
    meal_times: { breakfast: '08:30', lunch: '13:00', dinner: '20:00', snacks: '' },
    water_interval_hours: 2,
    water_start_time: '08:00',
    water_end_time: '20:00',
    weigh_in_day_of_week: 1,
    weigh_in_time: '08:00',
  } satisfies NotificationSettings,
  rooms: [
    { id: 'r1', name: 'Morning Crew' },
    { id: 'r2', name: 'Duo · Jack' },
  ],
  updateNotifSettings: vi.fn().mockResolvedValue(true),
  privacy: {
    share_calories_macros: false,
    share_weight_number: false,
    share_weight_progress: false,
    share_meals: 'always',
    share_workouts: true,
    share_workout_details: true,
  } as RoomPrivacySettings,
  getPrivacySettings: vi.fn(),
  updatePrivacySettings: vi.fn(),
  getSquadToday: vi.fn(),
  getHealthSyncPreferences: vi.fn(),
  setHealthSyncPreferences: vi.fn(),
  getNativeHealthPermission: vi.fn(),
  requestNativeHealthPermission: vi.fn(),
  disconnectNativeHealth: vi.fn(),
  updateCustomMacros: vi.fn(),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Modal: ({
    visible = true,
    children,
    ...rest
  }: Record<string, unknown> & { visible?: boolean; children?: React.ReactNode }) =>
    visible ? React.createElement('Modal', rest, children) : null,
  PanResponder: {
    create: () => ({ panHandlers: {} }),
  },
  Platform: { OS: 'ios' },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: {
    create: <T,>(styles: T) => styles,
    absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  },
  TextInput: 'TextInput',
  View: 'View',
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Svg: 'Svg',
  Circle: 'Circle',
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    back: state.back,
    push: vi.fn(),
    replace: vi.fn(),
    canGoBack: () => true,
  }),
}));

vi.mock('expo-notifications', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
}));

vi.mock('@calipartner/ui/v1', async () => {
  const theme = await import('../../../../packages/ui/src/v1/theme');
  return {
    ...theme,
    Badge: 'Badge',
    BellIcon: 'BellIcon',
    CheckIcon: 'CheckIcon',
    ChevronDownIcon: 'ChevronDownIcon',
    ChevronLeftIcon: 'ChevronLeftIcon',
    ChevronRightIcon: 'ChevronRightIcon',
    Chip: 'Chip',
    HeartIcon: 'HeartIcon',
    LinkButton: 'LinkButton',
    LockIcon: 'LockIcon',
    MinusIcon: 'MinusIcon',
    PlusIcon: 'PlusIcon',
    PrimaryButton: 'PrimaryButton',
    SecondaryButton: 'SecondaryButton',
    Segmented: 'Segmented',
    Switch: 'Switch',
    Text: 'Text',
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    profile: { nickname: 'Priya', username: 'priya' },
  }),
}));

vi.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

vi.mock('@/hooks/useNotificationSettings', () => ({
  useNotificationSettings: () => ({
    settings: state.notifSettings,
    isLoading: false,
    error: null,
    updateSettings: state.updateNotifSettings,
    muteRoomChat: vi.fn().mockResolvedValue(true),
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/hooks/useRooms', () => ({
  useRooms: () => ({
    rooms: state.rooms,
    loading: false,
  }),
}));

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ hasPlan: true, currentTier: 'pro' }),
}));

vi.mock('@/hooks/useTargets', () => ({
  useTargets: () => ({ updateCustomMacros: state.updateCustomMacros }),
}));

vi.mock('@/lib/sound', () => ({ playClickSound: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
vi.mock('@/services/diaryEvents', () => ({ diaryEvents: { emitChange: vi.fn() } }));
vi.mock('@/services/readCache', () => ({ invalidateReadCache: vi.fn() }));

vi.mock('@/services/notificationPermissionService', () => ({
  getNotificationPermissionStatus: vi.fn().mockResolvedValue('granted'),
}));

vi.mock('@/services/notificationSettingsService', () => ({
  isRoomChatMuted: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/components/notifications/NotificationPrimerModal', () => ({
  NotificationPrimerModal: 'NotificationPrimerModal',
}));

vi.mock('@/components/LoadingState', () => ({
  LoadingState: 'LoadingState',
}));

vi.mock('@/services/roomService', () => ({
  getPrivacySettings: (...args: unknown[]) => state.getPrivacySettings(...args),
  updatePrivacySettings: (...args: unknown[]) => state.updatePrivacySettings(...args),
}));

vi.mock('@/services/squadService', () => ({
  getSquadToday: (...args: unknown[]) => state.getSquadToday(...args),
}));

vi.mock('@/services/nativeHealthService', () => ({
  disconnectNativeHealth: (...args: unknown[]) => state.disconnectNativeHealth(...args),
  getHealthSyncPreferences: (...args: unknown[]) => state.getHealthSyncPreferences(...args),
  getNativeHealthPermission: (...args: unknown[]) => state.getNativeHealthPermission(...args),
  openNativeHealthSettings: vi.fn().mockResolvedValue(undefined),
  requestNativeHealthPermission: (...args: unknown[]) =>
    state.requestNativeHealthPermission(...args),
  setHealthSyncPreferences: (...args: unknown[]) => state.setHealthSyncPreferences(...args),
}));

import { NotificationSettingsScreen } from '@/components/notifications/NotificationSettingsScreen';
import { CustomMacrosModal } from '@/components/profile/CustomMacrosModal';
import { DailyGoalsModal } from '@/components/profile/DailyGoalsModal';
import { GoalsAndBodyModal } from '@/components/profile/GoalsAndBodyModal';
import { HealthSyncModal } from '@/components/profile/HealthSyncModal';
import { PerRoomVisibilityModal } from '@/components/profile/PerRoomVisibilityModal';

let tree: ReactTestRenderer | undefined;

const byId = (id: string) => tree!.root.findByProps({ testID: id });

describe('Profile & Settings Design System v1 subscreens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.updateNotifSettings.mockResolvedValue(true);
    state.getPrivacySettings.mockResolvedValue({ ...state.privacy });
    state.updatePrivacySettings.mockImplementation(
      async (_client: unknown, _roomId: string, next: RoomPrivacySettings) => next,
    );
    state.getSquadToday.mockResolvedValue({
      members: [{ user_id: 'u1', is_self: true, score: 64 }],
    });
    state.getHealthSyncPreferences.mockResolvedValue({
      steps: true,
      weight: true,
      workouts: true,
    });
    state.setHealthSyncPreferences.mockImplementation(async (prefs) => prefs);
    state.getNativeHealthPermission.mockResolvedValue('granted');
    state.requestNativeHealthPermission.mockResolvedValue('granted');
    state.disconnectNativeHealth.mockResolvedValue(undefined);
    state.updateCustomMacros.mockResolvedValue({ success: true });
  });

  afterEach(async () => {
    if (tree) {
      await act(async () => {
        tree?.unmount();
      });
      tree = undefined;
    }
  });

  it('SNotif: toggles master push, meal slot time, water interval, and fasting/squad alerts', async () => {
    await act(async () => {
      tree = create(<NotificationSettingsScreen />);
    });

    await act(async () => {
      byId('chip-water-interval-3h').props.onPress();
    });
    expect(state.updateNotifSettings).toHaveBeenCalledWith({
      water_interval_hours: 3,
      water_reminders_enabled: true,
    });

    await act(async () => {
      byId('switch-fasting-reminders').props.onValueChange(false);
    });
    expect(state.updateNotifSettings).toHaveBeenCalledWith({
      fasting_reminders_enabled: false,
    });

    await act(async () => {
      byId('switch-meal-breakfast').props.onValueChange(false);
    });
    expect(state.updateNotifSettings).toHaveBeenCalledWith({
      meal_reminders_enabled: true,
      meal_times: { breakfast: '', lunch: '13:00', dinner: '20:00', snacks: '' },
    });

    await act(async () => {
      byId('switch-pause-all').props.onValueChange(false);
    });
    expect(state.updateNotifSettings).toHaveBeenCalledWith({ pause_all: true });
  });

  it('SSquad: toggles per-room visibility settings and displays member lock chips', async () => {
    await act(async () => {
      tree = create(
        <PerRoomVisibilityModal
          visible
          onClose={vi.fn()}
          rooms={[
            {
              id: 'r1',
              name: 'Morning Crew',
              invite_code: 'ABC123',
              created_by: 'u1',
              max_members: 4,
              privacy_settings: state.privacy,
              created_at: '2026-11-01T00:00:00Z',
            } as never,
          ]}
        />,
      );
    });

    expect(state.getPrivacySettings).toHaveBeenCalledWith({}, 'r1');
    expect(tree!.root.findAllByType('LockIcon' as React.ElementType)).toHaveLength(2);

    await act(async () => {
      byId('visibility-toggle-calories').props.onValueChange(true);
    });
    expect(state.updatePrivacySettings).toHaveBeenCalledWith(
      {},
      'r1',
      expect.objectContaining({ share_calories_macros: true }),
    );
  });

  it('STargets: applies step and water presets and saves updated targets', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    await act(async () => {
      tree = create(
        <DailyGoalsModal
          visible
          onClose={onClose}
          currentStepGoal={10000}
          currentWaterGoalMl={3000}
          calorieTarget={1900}
          calorieFloor={1400}
          onSave={onSave}
        />,
      );
    });

    expect(byId('daily-steps-value').props.children).toBe('10,000');
    expect(byId('daily-water-value').props.children).toBe('3,000');

    await act(async () => {
      byId('preset-steps-12000').props.onPress();
      byId('preset-water-3500').props.onPress();
    });
    expect(byId('daily-steps-value').props.children).toBe('12,000');
    expect(byId('daily-water-value').props.children).toBe('3,500');

    await act(async () => {
      byId('btn-save-daily-goals').props.onPress();
    });
    expect(onSave).toHaveBeenCalledWith({ stepGoal: 12000, waterGoalMl: 3500 });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('SGoals: switches goal, adjusts weight/target/birthday, and persists body profile', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    await act(async () => {
      tree = create(
        <GoalsAndBodyModal
          visible
          onClose={onClose}
          currentGoal="cut"
          currentRate={0.5}
          currentHeightCm={178}
          currentWeightKg={73.5}
          currentTargetWeightKg={68}
          currentDateOfBirth="1999-03-12"
          currentActivityLevel="moderate"
          currentSex="female"
          units="metric"
          onSave={onSave}
        />,
      );
    });

    await act(async () => {
      byId('segment-goal-type').props.onChange('bulk');
      byId('input-weight-kg').props.onChangeText('74');
      byId('input-target-weight').props.onChangeText('78');
      byId('input-height').props.onChangeText('180');
      byId('segment-biological-sex').props.onChange('male');
    });

    await act(async () => {
      byId('btn-save-goals-body').props.onPress();
    });

    expect(onSave).toHaveBeenCalledWith({
      goal: 'bulk',
      rate: 0.5,
      heightCm: 180,
      weightKg: 74,
      targetWeightKg: 78,
      sex: 'male',
      dateOfBirth: '1999-03-12',
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('SHealth: updates sync category toggles and triggers manual sync', async () => {
    const onSyncNow = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      tree = create(
        <HealthSyncModal visible onClose={vi.fn()} isConnected onSyncNow={onSyncNow} />,
      );
    });

    await act(async () => {
      byId('switch-health-weight').props.onValueChange(false);
    });
    expect(state.setHealthSyncPreferences).toHaveBeenCalledWith({
      steps: true,
      weight: false,
      workouts: true,
    });

    await act(async () => {
      byId('btn-toggle-health-sync').props.onPress();
    });
    expect(onSyncNow).toHaveBeenCalledOnce();
  });

  it('SMacros: updates lock mode, resets recommended split, and saves custom macros', async () => {
    const onClose = vi.fn();
    const goal: GoalProfile = {
      id: 'g1',
      user_id: 'u1',
      goal: 'cut',
      activity_level: 'moderate',
      current_weight_kg: 73.5,
      input_height_cm: 178,
      body_fat_percentage: null,
      weekly_rate_kg: 0.5,
      target_weight_kg: 68,
      target_date: null,
      daily_calorie_target: 1900,
      protein_grams: 147,
      carb_grams: 209,
      fat_grams: 53,
      bmr: 1580,
      tdee: 2450,
      step_goal: 10000,
      water_ml_goal: 3000,
      custom_macros: true,
      effective_from: '2026-11-01T00:00:00Z',
      confirmed_at: '2026-11-01T00:00:00Z',
      recompute_reason: null,
      created_at: '2026-11-01T00:00:00Z',
    };

    await act(async () => {
      tree = create(<CustomMacrosModal goal={goal} sex="female" onClose={onClose} />);
    });

    expect(byId('custom-macros-preview').props.children).toBe('1,900');

    await act(async () => {
      byId('switch-lock-macros-grams').props.onValueChange(true);
      byId('btn-reset-macros').props.onPress();
    });

    await act(async () => {
      byId('custom-macros-override').props.onPress();
    });
    expect(state.updateCustomMacros).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
