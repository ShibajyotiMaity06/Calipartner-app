import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi, describe, beforeEach } from 'vitest';
import * as analyticsService from '@/services/analyticsService';

const mockRoute = vi.hoisted(() => ({
  pathname: '/onboarding/goal',
  segments: ['onboarding', 'goal'],
}));

vi.mock('expo-router', () => ({
  usePathname: () => mockRoute.pathname,
  useSegments: () => mockRoute.segments,
}));

import { ScreenAnalyticsTracker } from './ScreenAnalyticsTracker';

describe('ScreenAnalyticsTracker', () => {
  beforeEach(() => {
    analyticsService._resetAnalyticsStateForTesting();
    vi.clearAllMocks();
  });

  it('tracks screen transitions automatically on render and route update', async () => {
    const transitionSpy = vi.spyOn(analyticsService, 'recordScreenTransition');

    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<ScreenAnalyticsTracker />);
    });

    expect(transitionSpy).toHaveBeenCalledWith('/onboarding/goal', {
      route_segment: 'onboarding/goal',
    });

    mockRoute.pathname = '/today';
    mockRoute.segments = ['today'];

    await act(async () => {
      tree.update(<ScreenAnalyticsTracker />);
    });

    expect(transitionSpy).toHaveBeenCalledWith('/today', {
      route_segment: 'today',
    });
  });

  it('uses route templates for private Feed links and profiles', async () => {
    const transition = vi.spyOn(analyticsService, 'recordScreenTransition');
    mockRoute.pathname = '/feed/post/7fea0000-0000-4000-8000-000000000001';
    mockRoute.segments = ['feed', 'post', '[postId]'];
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<ScreenAnalyticsTracker />);
    });
    expect(transition).toHaveBeenLastCalledWith('/feed/post/[postId]', {
      route_segment: 'feed/post/[postId]',
    });
    mockRoute.pathname = '/feed/profile/7fea0000-0000-4000-8000-000000000002';
    mockRoute.segments = ['feed', 'profile', '[userId]'];
    await act(async () => {
      tree.update(<ScreenAnalyticsTracker />);
    });
    expect(transition).toHaveBeenLastCalledWith('/feed/profile/[userId]', {
      route_segment: 'feed/profile/[userId]',
    });
    await act(async () => tree.unmount());
  });
});
