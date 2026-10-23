import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AccessibilityInfo,
  Platform,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { dark } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { space } from '../tokens/space';
import { HomeIcon, TodayIcon, RoomIcon, ProgressIcon, MeIcon, PlusIcon } from './Icons';

export type TabId = 'today' | 'room' | 'log' | 'progress' | 'me';

export interface TabBarItemConfig {
  id: TabId;
  label: string;
  testID: string;
}

export interface TabBarLabels {
  today?: string;
  room?: string;
  progress?: string;
  me?: string;
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
  /** Controls visibility (hide on full-screen flows like scan, focus running) */
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

  const isGlass = !reduceTransparency && Platform.OS !== 'android';

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
          numberOfLines={1}
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
        isGlass ? styles.glassSurface : styles.opaqueSurface,
        style,
      ]}
      accessibilityRole="tablist"
    >
      {/* 1. Home */}
      {renderNormalTab('today', labels?.today ?? 'Home', HomeIcon, 'tab-today')}

      {/* 2. Progress */}
      {renderNormalTab('progress', labels?.progress ?? 'Progress', ProgressIcon, 'tab-progress')}

      {/* 3. Center Raised Plus Button */}
      <View style={styles.centerSlot}>
        <TouchableOpacity
          testID="tab-log"
          accessibilityRole="button"
          accessibilityLabel="Add to log"
          style={styles.plusButton}
          activeOpacity={0.8}
          onPress={() => onTabPress('log')}
        >
          <PlusIcon size={28} color={dark.onBrand} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* 4. Squad */}
      {renderNormalTab('room', labels?.room ?? 'Squad', RoomIcon, 'tab-room', hasRoomBadge)}

      {/* 5. Account */}
      {renderNormalTab('me', labels?.me ?? 'Account', MeIcon, 'tab-me')}
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  opaqueSurface: {
    backgroundColor: dark.s2,
  },
  glassSurface: {
    backgroundColor: Platform.OS === 'web' ? 'rgba(36, 30, 24, 0.88)' : dark.s2,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        } as unknown as ViewStyle)
      : {}),
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
  centerSlot: {
    width: 60,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 110,
  },
  plusButton: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: dark.apricot,
    borderWidth: 3,
    borderColor: dark.bg0,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -12 }],
  },
});
