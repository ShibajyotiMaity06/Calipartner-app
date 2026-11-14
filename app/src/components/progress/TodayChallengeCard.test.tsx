import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  error: 'NETWORK_UNAVAILABLE' as string | null,
  refresh: vi.fn(),
}));
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('@calipartner/ui', () => ({ Button: 'Button', Text: 'Text' }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/hooks/useChallenges', () => ({
  useChallenges: () => ({
    userId: 'owner',
    home: state.error ? null : { items: [] },
    loading: false,
    error: state.error,
    refresh: state.refresh,
  }),
}));
vi.mock('@/components/rooms/SquadViews', () => ({ squadStyles: {}, useSquadStyles: () => ({}) }));
import { TodayChallengeCard } from './TodayChallengeCard';
import { t } from '@/i18n';
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('identifies challenge failures, exposes retry and clears the panel after an empty successful read', async () => {
  await act(async () => {
    tree = create(<TodayChallengeCard />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain(t('homeRefresh.challengesLoadError'));
  await act(async () => tree.root.findByProps({ testID: 'home-challenge-retry' }).props.onPress());
  expect(state.refresh).toHaveBeenCalledOnce();
  state.error = null;
  await act(async () => tree.update(<TodayChallengeCard />));
  expect(tree.toJSON()).toBeNull();
});
