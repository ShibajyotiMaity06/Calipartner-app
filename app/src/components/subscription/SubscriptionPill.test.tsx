import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  tier: 'free',
  active: false,
  loading: false,
  error: null as string | null,
  push: vi.fn(),
}));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    currentTier: state.tier,
    hasActiveAccess: state.active,
    loading: state.loading,
    error: state.error,
  }),
}));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock('react-native', () => ({ Pressable: 'Pressable', View: 'View' }));
vi.mock('@calipartner/ui', async () => {
  const tokens = await import('../../../../packages/ui/src/tokens');
  return { ...tokens, Text: 'Text', useTheme: () => ({ colors: tokens.light }) };
});
import { SubscriptionPill } from './SubscriptionPill';
it.each([
  ['free', false, false, null, 'Upgrade', '/paywall'],
  ['plus', true, false, null, 'Go Pro', { pathname: '/paywall', params: { tier: 'pro' } }],
  ['pro', true, false, null, 'Pro', '/me'],
  ['pro', false, false, null, 'Upgrade', '/paywall'],
  ['free', false, true, null, 'Plans', '/paywall'],
  ['pro', true, false, 'offline', 'Plans', '/paywall'],
] as const)(
  'routes %s active=%s loading=%s error=%s honestly',
  async (tier, active, loading, error, label, destination) => {
    Object.assign(state, { tier, active, loading, error });
    state.push.mockClear();
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<SubscriptionPill />);
    });
    const button = tree.root.findByProps({ testID: 'btn-header-upgrade' });
    expect(button.props.style.minHeight).toBeGreaterThanOrEqual(44);
    expect(button.props.accessibilityRole).toBe('button');
    expect(JSON.stringify(tree.toJSON())).toContain(label);
    await act(async () => button.props.onPress());
    expect(state.push).toHaveBeenCalledWith(destination);
    await act(async () => tree.unmount());
  },
);
