import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RankedSquadMember } from '@calipartner/core';

const subscriptionState = vi.hoisted(() => ({
  hasActiveAccess: false,
  loading: false,
}));

const squadDetailsState = vi.hoisted(() => ({
  data: {
    meals: [{ section: 'breakfast', calories: 450, protein: 30, carbs: 50, fat: 15, items: [] }],
    workouts: [
      { id: 'w1', name: 'Morning Run', type: 'running', duration_minutes: 30, exercises: [] },
    ],
  },
  loading: false,
  error: false,
  refresh: vi.fn(),
}));

vi.mock('@calipartner/ui/theme', () => ({
  useTheme: () => ({
    colors: {
      bg0: '#000',
      s1: '#111',
      hairline: '#222',
      copper: '#c80',
      water: '#08c',
      textMid: '#888',
    },
  }),
}));

vi.mock('@calipartner/ui', () => ({
  Avatar: 'Avatar',
  Button: 'Button',
  Text: 'Text',
  homeLayout: { iconSize: 24, touchSize: 44, maxContentWidth: 600 },
  radius: { card: 12, full: 9999, control: 8 },
  space: [0, 4, 8, 12, 16, 20, 24, 28, 32],
  dark: {
    bg0: '#000',
    s1: '#111',
    s3: '#333',
    hairline: '#222',
    copper: '#c80',
    cream: '#fff',
    water: '#08c',
    textMid: '#888',
  },
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => subscriptionState,
}));

vi.mock('@/hooks/useSquad', () => ({
  useSquadDetails: () => squadDetailsState,
}));

vi.mock('./SquadViews', () => ({
  createSquadStyles: () => ({}),
  useSquadStyles: () => ({}),
  memberName: (m: RankedSquadMember) => (m.is_self ? 'You' : m.nickname),
  goalName: () => 'Cutting',
  numberText: (v: number | null) => String(v ?? ''),
  MemberMetrics: 'MemberMetrics',
  MemberDetailsContent: 'MemberDetailsContent',
  PlusDetailsCard: 'PlusDetailsCard',
}));

import { SquadPersonPanel } from './SquadPersonPanel';

describe('SquadPersonPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscriptionState.hasActiveAccess = false;
    subscriptionState.loading = false;
  });

  const selfMember: RankedSquadMember = {
    user_id: 'user-self',
    username: 'user_self',
    nickname: 'Me',
    role: 'member',
    status: 'active',
    avatar_url: null,
    is_self: true,
    score: 85,
    rank: 1,
    calories: 1800,
    protein: 140,
    carbs: 200,
    fat: 60,
    steps: 8000,
    water: 2500,
    goal: 'cut',
    local_date: '2026-11-19',
    height_cm: 175,
    weight_kg: 70,
    targets: { calories: 2000, protein: 150, carbs: 220, fat: 65, steps: 10000, water: 3000 },
  };

  const peerMember: RankedSquadMember = {
    ...selfMember,
    user_id: 'user-peer',
    nickname: 'Partner',
    is_self: false,
    rank: 2,
  };

  it('shows logged meals and workouts for a free user viewing their own profile without paywall', () => {
    subscriptionState.hasActiveAccess = false;
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <SquadPersonPanel
          roomId="room-1"
          person={selfMember}
          members={[selfMember, peerMember]}
          visible={true}
        />,
      );
    });

    expect(tree!.root.findAllByType('PlusDetailsCard' as React.ElementType)).toHaveLength(0);
    expect(tree!.root.findAllByType('MemberDetailsContent' as React.ElementType)).toHaveLength(1);
  });

  it('shows PlusDetailsCard paywall for a free user viewing another member profile', () => {
    subscriptionState.hasActiveAccess = false;
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <SquadPersonPanel
          roomId="room-1"
          person={peerMember}
          members={[selfMember, peerMember]}
          visible={true}
        />,
      );
    });

    expect(tree!.root.findAllByType('PlusDetailsCard' as React.ElementType)).toHaveLength(1);
    expect(tree!.root.findAllByType('MemberDetailsContent' as React.ElementType)).toHaveLength(0);
  });

  it('shows MemberDetailsContent for a paid user viewing another member profile', () => {
    subscriptionState.hasActiveAccess = true;
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <SquadPersonPanel
          roomId="room-1"
          person={peerMember}
          members={[selfMember, peerMember]}
          visible={true}
        />,
      );
    });

    expect(tree!.root.findAllByType('PlusDetailsCard' as React.ElementType)).toHaveLength(0);
    expect(tree!.root.findAllByType('MemberDetailsContent' as React.ElementType)).toHaveLength(1);
  });
});
