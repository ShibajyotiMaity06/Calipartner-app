import { Tabs, usePathname, useRouter } from 'expo-router';
import { TabBar, type TabId } from '@calipartner/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

  // Hide tab bar on full-screen flows (e.g. full-screen barcode scan, running focus timer)
  const isFullScreenFlow =
    pathname.includes('/scan') ||
    pathname.includes('/focus/running') ||
    pathname.includes('/onboarding');

  return (
    <Tabs
      tabBar={({ state, navigation }) => {
        const currentRoute = state.routes[state.index];
        const routeName = currentRoute?.name ?? 'today';
        const activeTab = (routeName === 'index' ? 'today' : routeName) as TabId;

        const handleTabPress = (tab: TabId) => {
          if (tab === 'log') {
            router.push('/(tabs)/log');
            return;
          }

          if (tab === activeTab) {
            const route = state.routes.find((r) => r.name === tab);
            if (route) {
              navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
            }
          } else {
            navigation.navigate(tab);
          }
        };

        const handleActiveTabPress = (tab: TabId) => {
          const route = state.routes.find((r) => r.name === tab);
          if (route) {
            navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
          }
        };

        return (
          <TabBar
            activeTab={activeTab}
            onTabPress={handleTabPress}
            onActiveTabPress={handleActiveTabPress}
            bottomInset={insets.bottom}
            hasRoomBadge={false}
            visible={!isFullScreenFlow}
          />
        );
      }}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: t('tabs.today'),
        }}
      />
      <Tabs.Screen
        name="room"
        options={{
          title: t('tabs.room'),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: t('tabs.log'),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: t('tabs.progress'),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: t('tabs.me'),
        }}
      />
    </Tabs>
  );
}
