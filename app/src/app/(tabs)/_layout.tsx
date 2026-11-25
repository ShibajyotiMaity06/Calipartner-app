import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs, useGlobalSearchParams, usePathname, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChartBarIcon,
  FeedImageIcon,
  FloatingTabBar,
  HomeIcon,
  SquadIcon,
  Text as V1Text,
  colors as v1Colors,
  layout as v1Layout,
  space as v1Space,
  type FloatingTabItem,
} from '@calipartner/ui/v1';
import { LogSheetModalV1 } from '@/components/diary/LogSheetModalV1';
import { closeBrowserModalsThen } from '@/hooks/useBrowserModalBack';
import { useNavigationBadges } from '@/hooks/useNavigationBadges';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { t } from '@/i18n';

export default function TabsLayout() {
  const { isOnline } = useNetworkStatus();
  const badges = useNavigationBadges();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { chat } = useGlobalSearchParams<{ chat?: string }>();
  const [logSheetOpen, setLogSheetOpen] = useState(false);

  // Hide tab bar on full-screen flows (e.g. full-screen barcode scan, onboarding, open chat)
  const isFullScreenFlow =
    pathname.includes('/scan') ||
    pathname.includes('/onboarding') ||
    (pathname.endsWith('/room') && chat === 'open');

  const v1Tabs: FloatingTabItem[] = [
    {
      id: 'today',
      label: t('homeV1.tabToday'),
      icon: (color) => <HomeIcon color={color} size={20} />,
      testID: 'tab-today',
    },
    {
      id: 'room',
      label: t('homeV1.tabSquad'),
      icon: (color) => <SquadIcon color={color} size={20} />,
      testID: 'tab-room',
    },
    {
      id: 'progress',
      label: t('homeV1.tabProgress'),
      icon: (color) => <ChartBarIcon color={color} size={20} />,
      testID: 'tab-progress',
    },
    {
      id: 'feed',
      label: t('homeV1.tabFeed'),
      icon: (color) => <FeedImageIcon color={color} size={20} />,
      testID: 'tab-feed',
    },
  ];

  return (
    <View style={styles.root}>
      {isOnline === false && (
        <V1Text
          variant="label"
          color="textMid"
          accessibilityLiveRegion="polite"
          style={styles.offlineBanner}
          testID="offline-read-banner"
        >
          {t('weightUpdate.offline')}
        </V1Text>
      )}

      <Tabs
        backBehavior="fullHistory"
        tabBar={({ state, navigation }) => {
          const currentRoute = state.routes[state.index];
          const routeName = currentRoute?.name ?? 'today';
          const normalized =
            routeName === 'index' ? 'today' : routeName === 'chat' ? 'room' : routeName;
          const activeId = v1Tabs.some((tab) => tab.id === normalized) ? normalized : 'today';

          const handleTabPress = (tabId: string) => {
            if (tabId === activeId) {
              const route = state.routes.find((r) => r.name === tabId);
              if (route) {
                navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
              }
              return;
            }
            closeBrowserModalsThen(() => router.navigate(`/(tabs)/${tabId}` as Href));
          };

          return (
            <FloatingTabBar
              tabs={v1Tabs}
              activeId={activeId}
              onSelect={handleTabPress}
              onLogPress={() => closeBrowserModalsThen(() => setLogSheetOpen(true))}
              logAccessibilityLabel={t('feed.openLog')}
              logTestID="tab-log"
              bottomOffset={Math.max(v1Layout.floatingBottomOffset, insets.bottom)}
              badges={{
                today: badges.today,
                room: badges.room,
                progress: badges.progress,
                feed: badges.feed,
              }}
              visible={!isFullScreenFlow}
            />
          );
        }}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: v1Colors.bg0 },
        }}
      >
        <Tabs.Screen name="today" options={{ title: t('homeV1.tabToday') }} />
        <Tabs.Screen name="room" options={{ title: t('homeV1.tabSquad') }} />
        <Tabs.Screen name="log" options={{ title: t('homeV1.logTitle') }} />
        <Tabs.Screen name="feed" options={{ title: t('homeV1.tabFeed') }} />
        <Tabs.Screen name="progress" options={{ title: t('homeV1.tabProgress') }} />
        <Tabs.Screen name="chat" options={{ title: t('rooms.segments.chat') }} />
        <Tabs.Screen name="me" options={{ title: t('tabs.me') }} />
      </Tabs>

      <LogSheetModalV1 visible={logSheetOpen} onClose={() => setLogSheetOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: v1Colors.bg0,
  },
  offlineBanner: {
    padding: v1Space.md,
  },
});
