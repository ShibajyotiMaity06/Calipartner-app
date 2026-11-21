import { useTheme as useAppearance } from '../theme/useTheme';
import { themeDock, themeDockBorder } from '../tokens/colors';
import React, { useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  AccessibilityInfo,
  Platform,
  useWindowDimensions,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { Text } from './Text';

import { radius } from '../tokens/radius';
import { space } from '../tokens/space';
import Svg, { Circle, Path } from 'react-native-svg';
function ChatIcon({ size = 24, color }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 4h16v12H9l-5 4V4Z"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function GlobeIcon({ size = 24, color }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M3 12h18M12 3a14 14 0 0 0 0 18 14 14 0 0 0 0-18Z" />
    </Svg>
  );
}
import { HomeIcon, RoomIcon, MeIcon } from './Icons';

export type TabId = 'today' | 'room' | 'feed' | 'progress' | 'me' | 'chat';

export interface TabBarItemConfig {
  id: TabId;
  label: string;
  testID: string;
}

export interface TabBarLabels {
  today?: string;
  room?: string;
  feed?: string;
  progress?: string;
  me?: string;
  chat?: string;
}

export interface TabBarProps {
  /** Currently active tab ID */
  activeTab: TabId;
  /** Callback when any tab is pressed */
  onTabPress: (tab: TabId) => void;
  /** Callback when the currently active tab is tapped again (for scroll-to-top) */
  onActiveTabPress?: (tab: TabId) => void;
  /** Whether the Room/Squad tab shows the 8px apricot badge dot */
  hasRoomBadge?: boolean;
  /** Controls visibility (hide on full-screen flows like scan) */
  visible?: boolean;
  /** Bottom safe area inset */
  bottomInset?: number;
  /** Optional manual override for reduce transparency */
  reduceTransparency?: boolean;
  /** Custom style override */
  style?: StyleProp<ViewStyle>;
  /** Test identifier */
  testID?: string;
  /** Configurable tab labels */
  labels?: TabBarLabels;
}

export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_INSET = 12;
export function getTabBarHeight(fontScale = 1): number {
  return TAB_BAR_HEIGHT + Math.max(0, Math.min(2, fontScale) - 1) * space[7];
}

export function TabBar({
  activeTab,
  onTabPress,
  onActiveTabPress,
  hasRoomBadge = false,
  visible = true,
  bottomInset = 0,
  reduceTransparency: forcedReduceTransparency,
  style,
  testID = 'floating-tab-bar',
  labels,
}: TabBarProps): React.JSX.Element | null {
  const { colors: dark, scheme } = useAppearance();
  const styles = createStyles(dark);

  const { fontScale } = useWindowDimensions();
  const [reduceTransparency, setReduceTransparency] = useState<boolean>(
    forcedReduceTransparency ?? false,
  );

  useEffect(() => {
    if (forcedReduceTransparency !== undefined) {
      setReduceTransparency(forcedReduceTransparency);
      return;
    }

    if (AccessibilityInfo.isReduceTransparencyEnabled) {
      AccessibilityInfo.isReduceTransparencyEnabled()
        .then((enabled) => setReduceTransparency(enabled))
        .catch(() => {});
    }

    const sub = AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', (enabled) => {
      setReduceTransparency(enabled);
    });

    return () => {
      sub?.remove?.();
    };
  }, [forcedReduceTransparency]);

  if (!visible) return null;

  const isGlass = !reduceTransparency;

  const handleTabPress = (tab: TabId) => {
    if (tab === activeTab && onActiveTabPress) {
      onActiveTabPress(tab);
    } else {
      onTabPress(tab);
    }
  };

  const renderNormalTab = (
    id: TabId,
    label: string,
    IconComponent: React.ComponentType<{
      size?: number;
      color?: string;
      filled?: boolean;
    }>,
    testId: string,
    showBadge = false,
  ) => {
    const isActive = activeTab === id;
    const color = isActive ? dark.apricot : dark.textLo;

    return (
      <TouchableOpacity
        key={id}
        testID={testId}
        accessibilityRole="tab"
        accessibilityLabel={showBadge ? `${label}, unread updates` : label}
        accessibilityState={{ selected: isActive }}
        style={styles.tabSlot}
        activeOpacity={0.7}
        onPress={() => handleTabPress(id)}
      >
        <View style={styles.iconContainer}>
          <IconComponent size={24} color={color} filled={isActive} />
          {showBadge ? (
            <View
              testID="tab-room-badge"
              style={styles.badgeDot}
              accessibilityLabel="Unread updates"
            />
          ) : null}
        </View>
        <Text
          numberOfLines={2}
          style={[styles.tabLabel, { color }, isActive && styles.activeTabLabel]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const dynamicBottom = Math.max(
    TAB_BAR_INSET,
    TAB_BAR_INSET + (bottomInset > 0 ? bottomInset - 4 : 0),
  );

  return (
    <View
      testID={testID}
      style={[
        styles.floatingContainer,
        { bottom: dynamicBottom },
        { height: getTabBarHeight(fontScale) },
        isGlass
          ? [
              styles.glassSurface,
              {
                backgroundColor: themeDock[scheme],
                borderColor: themeDockBorder[scheme],
                borderTopColor:
                  scheme === 'light' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.38)',
              },
            ]
          : styles.opaqueSurface,
        style,
      ]}
      accessibilityRole="tablist"
    >
      {isGlass && <View pointerEvents="none" style={styles.glassHighlight} />}
      {/* 1. Home */}
      {renderNormalTab('today', labels?.today ?? 'Home', HomeIcon, 'tab-today')}

      {/* 2. Progress */}
      {renderNormalTab('room', labels?.room ?? 'Squad', RoomIcon, 'tab-room', hasRoomBadge)}

      {renderNormalTab('feed', labels?.feed ?? 'Feed', GlobeIcon, 'tab-feed')}

      {/* 4. Chat */}
      {renderNormalTab('chat', labels?.chat ?? 'Chat', ChatIcon, 'tab-chat')}

      {/* 5. Account */}
      {renderNormalTab('progress', labels?.progress ?? 'You', MeIcon, 'tab-progress')}
    </View>
  );
}

const createStyles = (dark: ReturnType<typeof useAppearance>['colors']) =>
  StyleSheet.create({
    floatingContainer: {
      position: 'absolute',
      left: space[3], // 12
      right: space[3], // 12
      height: TAB_BAR_HEIGHT, // 64
      borderRadius: radius.full, // 999
      borderWidth: 1,
      borderColor: dark.hairline,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space[2], // 8
      zIndex: 100,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 16,
      elevation: 8,
    },
    opaqueSurface: {
      backgroundColor: dark.s2,
    },
    glassSurface: {
      borderColor: dark.hairlineLit,
      borderTopColor: 'rgba(255, 255, 255, 0.38)',
      borderBottomColor: 'rgba(0, 0, 0, 0.45)',
      backgroundColor: Platform.OS === 'web' ? 'rgba(22, 19, 16, 0.58)' : 'rgba(26, 21, 17, 0.65)',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.42,
      shadowRadius: 22,
      elevation: 12,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? ({
            backdropFilter: 'blur(32px) saturate(200%) brightness(1.1)',
            WebkitBackdropFilter: 'blur(32px) saturate(200%) brightness(1.1)',
          } as unknown as ViewStyle)
        : {}),
    },
    glassHighlight: {
      position: 'absolute',
      top: 1,
      left: space[4],
      right: space[4],
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      borderRadius: radius.full,
      zIndex: 1,
    },
    tabSlot: {
      flex: 1,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: space[1], // 4
    },
    iconContainer: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    badgeDot: {
      position: 'absolute',
      top: -1,
      right: -3,
      width: 8,
      height: 8,
      borderRadius: radius.full,
      backgroundColor: dark.apricot,
    },
    tabLabel: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '500',
      marginTop: 2,
      textAlign: 'center',
    },
    activeTabLabel: {
      fontWeight: '600',
    },
  });
