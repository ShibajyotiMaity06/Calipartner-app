import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
const route = vi.hoisted(() => ({ pathname: '/room', chat: 'open' as string | undefined }));
vi.mock('@/hooks/useBrowserModalBack', () => ({
  closeBrowserModalsThen: (fn: () => void) => fn(),
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  TabBar: 'TabBar',
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
    useRouter: () => ({}),
  };
});
import TabsLayout from '@/app/(tabs)/_layout';
it('hides app navigation only for open squad chat and restores it on exit or another page', async () => {
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<TabsLayout />);
  });
  expect(tree.root.findByType('TabBar' as React.ElementType).props.visible).toBe(false);
  route.chat = undefined;
  await act(async () => tree.update(<TabsLayout />));
  expect(tree.root.findByType('TabBar' as React.ElementType).props.visible).toBe(true);
  route.chat = 'open';
  route.pathname = '/today';
  await act(async () => tree.update(<TabsLayout />));
  expect(tree.root.findByType('TabBar' as React.ElementType).props.visible).toBe(true);
  await act(async () => tree.unmount());
});
