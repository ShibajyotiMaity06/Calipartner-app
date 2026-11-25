import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';

vi.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
vi.mock('@/hooks/useNavigationBadges', () => ({
  useNavigationBadges: () => ({ chat: 0, room: 0, feed: 0, today: 0, progress: 0 }),
}));

const route = vi.hoisted(() => ({ pathname: '/room', chat: 'open' as string | undefined }));

vi.mock('@/hooks/useBrowserModalBack', () => ({
  closeBrowserModalsThen: (fn: () => void) => fn(),
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock('@calipartner/ui/v1', async () => ({
  ...(await import('../../../../packages/ui/src/v1/theme')),
  FloatingTabBar: 'FloatingTabBar',
  HomeIcon: 'HomeIcon',
  SquadIcon: 'SquadIcon',
  ChartBarIcon: 'ChartBarIcon',
  FeedImageIcon: 'FeedImageIcon',
  Text: 'Text',
}));
vi.mock('@/components/diary/LogSheetModalV1', () => ({
  LogSheetModalV1: 'LogSheetModalV1',
}));
vi.mock('expo-router', () => {
  const Tabs = ({ tabBar }: { tabBar: (props: unknown) => React.ReactNode }) =>
    tabBar({ state: { routes: [{ name: 'room' }], index: 0 }, navigation: { emit: vi.fn() } });
  Tabs.Screen = function TabScreen() {
    return null;
  };
  return {
    Tabs,
    usePathname: () => route.pathname,
    useGlobalSearchParams: () => ({ chat: route.chat }),
    useRouter: () => ({ navigate: vi.fn() }),
  };
});

import TabsLayout from '@/app/(tabs)/_layout';

it('hides FloatingTabBar only for open squad chat, restores it otherwise, and opens LogSheetModalV1 on + tap', async () => {
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<TabsLayout />);
  });

  const bar = () => tree.root.findByType('FloatingTabBar' as React.ElementType);
  const sheet = () => tree.root.findByType('LogSheetModalV1' as React.ElementType);

  expect(bar().props.visible).toBe(false);
  expect(bar().props.tabs.map((tab: { id: string }) => tab.id)).toEqual([
    'today',
    'room',
    'progress',
    'feed',
  ]);
  expect(sheet().props.visible).toBe(false);

  route.chat = undefined;
  await act(async () => tree.update(<TabsLayout />));
  expect(bar().props.visible).toBe(true);

  route.chat = 'open';
  route.pathname = '/today';
  await act(async () => tree.update(<TabsLayout />));
  expect(bar().props.visible).toBe(true);

  await act(async () => bar().props.onLogPress());
  expect(sheet().props.visible).toBe(true);

  await act(async () => sheet().props.onClose());
  expect(sheet().props.visible).toBe(false);

  await act(async () => tree.unmount());
});
