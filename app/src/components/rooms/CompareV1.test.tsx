import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  params: { room: 'room-1', left: 'u1', right: 'u2' },
  locked: false,
  push: vi.fn(),
  back: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn().mockResolvedValue(undefined),
  saveTracking: vi.fn().mockResolvedValue(undefined),
  comparePayload: {
    room_id: 'room-1',
    range: '7d',
    is_pro: true,
    locked: false,
    left: {
      user_id: 'u1',
      name: 'You',
      overall_pct: 75,
      tracker_count: 5,
      workouts_shared: true,
      meals_shared: true,
    },
    right: {
      user_id: 'u2',
      name: 'Jack',
      overall_pct: 90,
      tracker_count: 6,
      workouts_shared: true,
      meals_shared: true,
    },
    in_sync_pct: 85,
    days_together: 4,
    shared_workouts: 3,
    days_strip: [
      { date: '2026-11-16', label: 'M', status: 'both', left_pct: 84, right_pct: 90 },
      { date: '2026-11-17', label: 'T', status: 'both', left_pct: 82, right_pct: 92 },
      { date: '2026-11-18', label: 'W', status: 'one', left_pct: 72, right_pct: 88 },
      { date: '2026-11-19', label: 'T', status: 'both', left_pct: 88, right_pct: 91 },
      { date: '2026-11-20', label: 'F', status: 'one', left_pct: 70, right_pct: 86 },
      { date: '2026-11-21', label: 'S', status: 'both', left_pct: 81, right_pct: 95 },
      { date: '2026-11-22', label: 'S', status: 'neither', left_pct: 50, right_pct: 72 },
    ],
    head_to_head: [
      { key: 'workouts', left_value: 3, right_value: 5, unit: 'count' },
      { key: 'steps', left_value: 82, right_value: 96, unit: 'pct' },
      { key: 'water', left_value: 71, right_value: 80, unit: 'pct' },
    ],
    macros: [
      { key: 'protein', left_pct: 92, right_pct: 101 },
      { key: 'carbs', left_pct: 104, right_pct: 97 },
      { key: 'fat', left_pct: 98, right_pct: 95 },
    ],
    today_rows: [
      {
        key: 'workout',
        left_tracks: true,
        right_tracks: true,
        left_pct: null,
        right_pct: null,
        left_label: null,
        right_label: 'Leg day · 52 min',
        left_is_rest: true,
        right_is_rest: false,
        left_done: false,
        right_done: true,
      },
      {
        key: 'steps',
        left_tracks: false,
        right_tracks: true,
        left_pct: 0,
        right_pct: 96,
      },
    ],
    workouts_detail: {
      left: {
        shared: true,
        count: 3,
        splits: [{ label: 'Push', count: 1 }],
        duration_minutes: 141,
        volume_kg: 14600,
      },
      right: {
        shared: true,
        count: 5,
        splits: [{ label: 'Upper', count: 2 }],
        duration_minutes: 250,
        volume_kg: 21400,
      },
    },
    meals_detail: {
      left: {
        shared: true,
        top_items: [{ name: 'Oatmeal with banana', count: 5 }],
        meals_per_day: 3.2,
      },
      right: {
        shared: true,
        top_items: [{ name: 'Scrambled eggs', count: 6 }],
        meals_per_day: 3.6,
      },
    },
  },
}));

vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  RefreshControl: 'RefreshControl',
  Share: { share: vi.fn().mockResolvedValue({ action: 'sharedAction' }) },
  StyleSheet: { create: <T,>(v: T) => v },
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Svg: 'Svg',
  Circle: 'Circle',
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    useRouter: () => ({
      push: state.push,
      back: state.back,
      replace: state.replace,
      canGoBack: () => true,
    }),
    useLocalSearchParams: () => state.params,
    useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
  };
});

vi.mock('@calipartner/ui/v1', () => ({
  Text: 'Text',
  AvatarRing: 'AvatarRing',
  Badge: 'Badge',
  Segmented: 'Segmented',
  PrimaryButton: 'PrimaryButton',
  IconButton: 'IconButton',
  ProgressBar: 'ProgressBar',
  Sheet: ({
    visible,
    testID,
    children,
  }: {
    visible?: boolean;
    testID?: string;
    children?: React.ReactNode;
  }) => (visible ? React.createElement('View', { testID }, children) : null),
  ArrowRightIcon: 'ArrowRightIcon',
  CheckIcon: 'CheckIcon',
  ChevronLeftIcon: 'ChevronLeftIcon',
  CloseIcon: 'CloseIcon',
  InfoCircleIcon: 'InfoCircleIcon',
  LockIcon: 'LockIcon',
  ShareUploadIcon: 'ShareUploadIcon',
  borders: { width: 1 },
  colors: {
    bg0: '#0E0B08',
    s1: '#1A1511',
    s2: '#241E18',
    hairline: '#3A3228',
    hairlineLit: '#85755F',
    textHi: '#F7F0E7',
    textMid: '#C9BCAC',
    textLo: '#9A8E7F',
    apricot: '#F4B67D',
    onBrand: '#1C1109',
  },
  fonts: { regular: 'Manrope', semibold: 'Manrope', bold: 'Manrope' },
  layout: { screenPaddingX: 24, minTouchTarget: 44 },
  radius: { chip: 16, card: 22, hero: 28, bar: 4, full: 999 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
}));

vi.mock('@/components/rooms/TrackingPreferencesSheet', () => ({
  TrackingPreferencesSheet: 'TrackingPreferencesSheet',
}));

vi.mock('@/hooks/useTrackingPreferences', () => ({
  useTrackingPreferences: () => ({
    enabled: { calories: true, protein: true, carbs: true, fat: true, steps: false, water: true },
    loading: false,
    error: false,
    save: state.saveTracking,
  }),
}));

vi.mock('@/hooks/useSquad', () => ({
  useSquadCompare: () => ({
    data: {
      ...state.comparePayload,
      locked: state.locked,
      workouts_detail: state.locked ? null : state.comparePayload.workouts_detail,
      meals_detail: state.locked ? null : state.comparePayload.meals_detail,
    },
    loading: false,
    error: false,
    refresh: state.refresh,
  }),
}));

import CompareScreen from '@/app/squad/compare';

let tree: ReactTestRenderer | undefined;

describe('CompareScreen Design System v1', () => {
  beforeEach(() => {
    state.locked = false;
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

  it('renders Pro overview, workouts, meals and opens How compare works sheet', async () => {
    await act(async () => {
      tree = create(<CompareScreen />);
    });

    expect(tree!.root.findByProps({ testID: 'compare-overview-hero' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'compare-days-together-card' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'compare-head-to-head-card' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'compare-macros-card' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'compare-workouts-card' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'compare-meals-card' })).toBeDefined();

    await act(async () => {
      tree!.root.findByProps({ testID: 'btn-how-compare-works' }).props.onPress();
    });
    expect(tree!.root.findByProps({ testID: 'sheet-how-compare-works' })).toBeDefined();
  });

  it('shows locked workout/meal card on Free tier while keeping macros and Today comparison visible', async () => {
    state.locked = true;
    await act(async () => {
      tree = create(<CompareScreen />);
    });

    expect(tree!.root.findByProps({ testID: 'compare-macros-card' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'compare-pro-locked-card' })).toBeDefined();
    expect(tree!.root.findAllByProps({ testID: 'compare-workouts-card' })).toHaveLength(0);

    await act(async () => {
      tree!.root.findByProps({ testID: 'btn-compare-unlock-pro' }).props.onPress();
    });
    expect(state.push).toHaveBeenCalledWith('/paywall');

    await act(async () => {
      tree!.root.findByProps({ testID: 'compare-range-segmented' }).props.onChange('today');
    });
    expect(tree!.root.findByProps({ testID: 'compare-today-view' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'btn-track-missing-steps' })).toBeDefined();
  });
});
