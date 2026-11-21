import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  user: { id: 'test-user-123' },
  rpcData: { chat: 3, room: 1, feed: 2, today: 0, progress: 0 },
  rpcError: null,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockState.user, profile: null }),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    rpc: vi.fn().mockResolvedValue({
      data: mockState.rpcData,
      error: mockState.rpcError,
    }),
  }),
}));

vi.mock('@/services/requestInboxEvents', () => ({
  subscribeRequestInbox: vi.fn(() => () => {}),
}));

vi.mock('react-native', () => ({
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

import { useNavigationBadges } from './useNavigationBadges';

let latestBadges: ReturnType<typeof useNavigationBadges>;

function TestProbe() {
  latestBadges = useNavigationBadges();
  return null;
}

describe('useNavigationBadges Hook', () => {
  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.clearAllMocks();
  });

  it('fetches and returns cumulative badge counts for chat, room, and feed', async () => {
    await act(async () => {
      create(<TestProbe />);
    });

    expect(latestBadges).toEqual({
      chat: 3,
      room: 1,
      feed: 2,
      today: 0,
      progress: 0,
    });
  });

  it('defaults to 0 when user is signed out', async () => {
    mockState.user = null as never;
    await act(async () => {
      create(<TestProbe />);
    });

    expect(latestBadges).toEqual({
      chat: 0,
      room: 0,
      feed: 0,
      today: 0,
      progress: 0,
    });
    // restore
    mockState.user = { id: 'test-user-123' };
  });
});
