/**
 * CaliPartner Design System v1 — Surfaces, Sheets, Rows & Tab Bar
 * Single source of truth: docs/ui/DESIGN_SYSTEM_V1.md (Section 6.6 & 6.7 & 7)
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import { AddButton, LogFabButton, PrimaryButton } from './Buttons';
import { motion, usePressScale } from './motion';
import { AvatarRing } from './Progress';
import { Switch } from './Selection';
import { Text } from './Text';
import { borders, colors, elevation, fonts, layout, radius, space } from './theme';

export type CardVariant = 'default' | 'hero' | 'highlight' | 'inner';

export interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Design System v1 Card surface:
 * - default: s1, 1 hairline, radius 22, padding 16
 * - hero: s1, 1 hairline, radius 28, padding 20
 * - highlight: s2 fill, 1.5 apricot border
 * - inner: s2, radius 16, padding 12 x 14
 */
export function Card({
  children,
  variant = 'default',
  onPress,
  accessibilityLabel,
  testID,
  style,
}: CardProps): React.JSX.Element {
  const { reduceMotion } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale(reduceMotion);

  const surfaceBg = variant === 'highlight' || variant === 'inner' ? colors.s2 : colors.s1;
  const pressedBg = surfaceBg === colors.s1 ? colors.s2 : colors.s3;
  const borderWidth =
    variant === 'highlight' ? borders.selectedWidth : variant === 'inner' ? 0 : borders.width;
  const borderColor = variant === 'highlight' ? colors.apricot : colors.hairline;
  const cardRadius =
    variant === 'hero' ? radius.hero : variant === 'inner' ? radius.chip : radius.card;
  const padV =
    variant === 'hero'
      ? layout.heroCardPadding
      : variant === 'inner'
        ? space.md
        : layout.cardPadding;
  const padH =
    variant === 'hero'
      ? layout.heroCardPadding
      : variant === 'inner'
        ? space.optical14
        : layout.cardPadding;

  const baseStyle: ViewStyle = {
    backgroundColor: surfaceBg,
    borderWidth,
    borderColor,
    borderRadius: cardRadius,
    paddingVertical: padV,
    paddingHorizontal: padH,
  };

  if (!onPress) {
    return (
      <View accessibilityLabel={accessibilityLabel} testID={testID} style={[baseStyle, style]}>
        {children}
      </View>
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={({ pressed }) => [baseStyle, pressed ? { backgroundColor: pressedBg } : null, style]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  showGrabber?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Bottom sheet: s1, top radius 32, 1 hairlineLit top border, padding 10 / 20 / 26,
 * grabber 40 x 5 in hairline, scrim behind, spring damping 20 stiffness 220.
 */
export function Sheet({
  visible,
  onClose,
  children,
  showGrabber = true,
  accessibilityLabel = 'Bottom sheet',
  testID,
  style,
}: SheetProps): React.JSX.Element {
  const { reduceMotion } = useTheme();
  const translateY = useRef(new Animated.Value(reduceMotion ? 0 : 40)).current;

  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      translateY.setValue(0);
      return;
    }
    translateY.setValue(40);
    Animated.spring(translateY, {
      toValue: 0,
      damping: motion.sheetSpring.damping,
      stiffness: motion.sheetSpring.stiffness,
      mass: motion.sheetSpring.mass,
      useNativeDriver: true,
    }).start();
  }, [visible, reduceMotion, translateY]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'fade' : 'none'}
      onRequestClose={onClose}
      accessibilityViewIsModal
      testID={testID}
    >
      <View style={styles.sheetRoot}>
        <Pressable
          style={styles.scrim}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
        />
        <Animated.View
          accessibilityLabel={accessibilityLabel}
          style={[styles.sheetSurface, elevation.sheet, { transform: [{ translateY }] }, style]}
        >
          {showGrabber ? <View style={styles.grabber} /> : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

export interface ToastBarProps {
  message: string;
  visible: boolean;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Toast bar: h 64, radius 32, s1, 1 hairlineLit, text 15 plus optional compact primary button. */
export function ToastBar({
  message,
  visible,
  actionLabel,
  onAction,
  testID,
  style,
}: ToastBarProps): React.JSX.Element | null {
  if (!visible) return null;

  return (
    <View
      style={[styles.toastBar, elevation.floatingBar, style]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      testID={testID}
    >
      <Text variant="body" color="textHi" style={styles.toastMessage} numberOfLines={2}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <PrimaryButton
          title={actionLabel}
          onPress={onAction}
          compact
          compactHeight={40}
          testID={testID ? `${testID}-action` : undefined}
        />
      ) : null}
    </View>
  );
}

export interface ListRowProps {
  title: string;
  meta?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  showDivider?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** List row: padding 12 x 0, 1 pt s2 divider, title 15-16/700, meta 13 textLo, trailing value. */
export function ListRow({
  title,
  meta,
  leading,
  trailing,
  onPress,
  showDivider = true,
  accessibilityLabel,
  testID,
  style,
}: ListRowProps): React.JSX.Element {
  const rowContent = (
    <View style={styles.listRowInner}>
      {leading ? <View style={styles.rowLeading}>{leading}</View> : null}
      <View style={styles.rowBody}>
        <Text variant="rowTitle" color="textHi" numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text variant="meta" color="textLo" numberOfLines={2}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.rowTrailing}>{trailing}</View> : null}
    </View>
  );

  return (
    <View style={[styles.listRowWrap, style]}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? title}
          testID={testID}
          style={({ pressed }) => [
            styles.listRowPress,
            pressed ? { backgroundColor: colors.s2 } : null,
          ]}
        >
          {rowContent}
        </Pressable>
      ) : (
        <View style={styles.listRowPress} testID={testID}>
          {rowContent}
        </View>
      )}
      {showDivider ? <View style={styles.rowDivider} /> : null}
    </View>
  );
}

export interface SwitchRowProps {
  title: string;
  meta?: string;
  icon: React.ReactNode;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  showDivider?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Switch row: 44 pt icon tile, title 15/700, meta 13, switch on the right. */
export function SwitchRow({
  title,
  meta,
  icon,
  value,
  onValueChange,
  disabled = false,
  showDivider = true,
  testID,
  style,
}: SwitchRowProps): React.JSX.Element {
  return (
    <View style={style}>
      <View style={styles.switchRow}>
        <View style={styles.tile44}>{icon}</View>
        <View style={styles.rowBody}>
          <Text variant="rowTitle" color="textHi">
            {title}
          </Text>
          {meta ? (
            <Text variant="meta" color="textLo">
              {meta}
            </Text>
          ) : null}
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          accessibilityLabel={title}
          testID={testID}
        />
      </View>
      {showDivider ? <View style={styles.rowDivider} /> : null}
    </View>
  );
}

export interface MealRowProps {
  title: string;
  meta?: string;
  kcal: string;
  icon: React.ReactNode;
  onAdd?: () => void;
  onPress?: () => void;
  addAccessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Meal row: card radius 22, padding 14 x 16, 44 pt icon tile, title, meta, kcal, 36 pt add button. */
export function MealRow({
  title,
  meta,
  kcal,
  icon,
  onAdd,
  onPress,
  addAccessibilityLabel,
  testID,
  style,
}: MealRowProps): React.JSX.Element {
  return (
    <Card onPress={onPress} testID={testID} style={[styles.mealRowCard, style]}>
      <View style={styles.tile44}>{icon}</View>
      <View style={styles.rowBody}>
        <Text variant="rowTitle" color="textHi" numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text variant="meta" color="textLo" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      <Text variant="label" color="textMid" tabular>
        {kcal}
      </Text>
      {onAdd ? (
        <AddButton
          onPress={onAdd}
          size={36}
          accessibilityLabel={addAccessibilityLabel ?? `Add to ${title}`}
          testID={testID ? `${testID}-add` : undefined}
        />
      ) : null}
    </Card>
  );
}

export interface LeaderboardRowProps {
  rank: number;
  name: string;
  status: string;
  percentage: number;
  isCurrentUser?: boolean;
  ringColor?: string;
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Leaderboard row: rank 13/700 textLo, 48 pt avatar ring, name 15/700,
 * status 12 textLo, percentage in numS. Current user row has s2 fill and radius 18.
 */
export function LeaderboardRow({
  rank,
  name,
  status,
  percentage,
  isCurrentUser = false,
  ringColor = colors.apricot,
  onPress,
  testID,
  style,
}: LeaderboardRowProps): React.JSX.Element {
  const inner = (
    <View style={[styles.leaderboardRow, isCurrentUser ? styles.leaderboardCurrent : null, style]}>
      <Text
        tabular
        style={{
          fontFamily: fonts.bold,
          fontSize: 13,
          color: colors.textLo,
          width: 24,
          textAlign: 'center',
        }}
      >
        {String(rank)}
      </Text>
      <AvatarRing initial={name} progress={percentage / 100} color={ringColor} />
      <View style={styles.rowBody}>
        <Text variant="rowTitle" color="textHi" style={{ fontSize: 15 }} numberOfLines={1}>
          {name}
        </Text>
        <Text variant="micro" color="textLo" style={{ fontSize: 12 }} numberOfLines={1}>
          {status}
        </Text>
      </View>
      <Text variant="numS" color="textHi" tabular>
        {`${Math.round(percentage)}%`}
      </Text>
    </View>
  );

  if (!onPress) {
    return (
      <View testID={testID} accessibilityRole="summary">
        {inner}
      </View>
    );
  }

  return (
    <Pressable onPress={onPress} testID={testID} accessibilityRole="button">
      {inner}
    </Pressable>
  );
}

export interface FloatingTabItem {
  id: string;
  label: string;
  icon: (color: string, active: boolean) => React.ReactNode;
  testID?: string;
}

export interface FloatingTabBarProps {
  tabs: readonly FloatingTabItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onLogPress: () => void;
  logAccessibilityLabel?: string;
  logTestID?: string;
  bottomOffset?: number;
  visible?: boolean;
  badges?: Partial<Record<string, number>>;
  testID?: string;
}

/**
 * Floating tab bar (Section 6.6):
 * Pill h 64, radius 32, padding 8, s1, 1 hairline, 20 from sides, 26 from bottom.
 * Four tabs 48x48; active tab uses an s3 capsule with apricot icon and 13/700 label.
 * Separate 64 pt apricot Log button sits to its right with a 12 pt gap.
 * 150 pt gradient (transparent to bg0) sits behind both.
 */
export function FloatingTabBar({
  tabs,
  activeId,
  onSelect,
  onLogPress,
  logAccessibilityLabel = 'Log activity',
  logTestID = 'tab-log-fab',
  bottomOffset = layout.floatingBottomOffset,
  visible = true,
  badges,
  testID = 'v1-floating-tab-bar',
}: FloatingTabBarProps): React.JSX.Element | null {
  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={styles.tabBarDock}>
      <View pointerEvents="none" style={styles.tabGradientWrap}>
        <Svg width="100%" height={104} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="tabFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.bg0} stopOpacity="0" />
              <Stop offset="1" stopColor={colors.bg0} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="104" fill="url(#tabFade)" />
        </Svg>
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.tabRow,
          {
            paddingHorizontal: layout.floatingEdge,
            paddingBottom: bottomOffset,
          },
        ]}
      >
        <View
          accessibilityRole="tablist"
          testID={testID}
          style={[styles.tabPill, elevation.floatingBar]}
        >
          {tabs.map((tab) => {
            const active = tab.id === activeId;
            const badgeCount = badges?.[tab.id] ?? 0;
            return (
              <Pressable
                key={tab.id}
                onPress={() => onSelect(tab.id)}
                accessibilityRole="tab"
                accessibilityLabel={
                  badgeCount > 0 ? `${tab.label}, ${badgeCount} unread` : tab.label
                }
                accessibilityState={{ selected: active }}
                testID={tab.testID ?? `tab-${tab.id}`}
                style={[styles.tabSlot, active ? styles.tabSlotActive : null]}
              >
                <View style={styles.tabIconWrap}>
                  {tab.icon(active ? colors.apricot : colors.textLo, active)}
                  {badgeCount > 0 && !active ? <View style={styles.tabBadgeDot} /> : null}
                </View>
                {active ? (
                  <Text variant="tabLabel" color="textHi" numberOfLines={1}>
                    {tab.label}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <LogFabButton
          onPress={onLogPress}
          accessibilityLabel={logAccessibilityLabel}
          testID={logTestID}
        />
      </View>
    </View>
  );
}

export interface NotificationPreviewProps {
  title: string;
  body: string;
  appName?: string;
  timeLabel?: string;
  icon?: React.ReactNode;
  showStackPeek?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Notification preview card: 38 pt apricot-free app tile and floating shadow (Section 6.6). */
export function NotificationPreview({
  title,
  body,
  appName,
  timeLabel = 'now',
  icon,
  showStackPeek = false,
  testID,
  style,
}: NotificationPreviewProps): React.JSX.Element {
  return (
    <View style={[showStackPeek ? styles.notificationStack : null, style]}>
      {showStackPeek ? <View style={styles.notificationPeek} /> : null}
      <View
        testID={testID}
        accessibilityRole="summary"
        style={[styles.notificationCard, elevation.notificationPreview]}
      >
        <View style={styles.notificationTile}>{icon}</View>
        <View style={styles.rowBody}>
          {appName ? (
            <>
              <View style={styles.notificationHeader}>
                <Text variant="micro" color="textLo" style={styles.notificationAppName}>
                  {appName}
                </Text>
                <Text variant="micro" color="textLo">
                  {timeLabel}
                </Text>
              </View>
              <Text
                variant="rowTitle"
                color="textHi"
                style={styles.notificationTitle}
                numberOfLines={1}
              >
                {title}
              </Text>
            </>
          ) : (
            <View style={styles.notificationHeader}>
              <Text
                variant="rowTitle"
                color="textHi"
                style={styles.notificationTitle}
                numberOfLines={1}
              >
                {title}
              </Text>
              <Text variant="micro" color="textLo">
                {timeLabel}
              </Text>
            </View>
          )}
          <Text variant="body" color="textMid" numberOfLines={2}>
            {body}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.scrim,
  },
  sheetSurface: {
    backgroundColor: colors.s1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: borders.width,
    borderLeftWidth: borders.width,
    borderRightWidth: borders.width,
    borderColor: colors.hairlineLit,
    paddingTop: space.optical10,
    paddingHorizontal: layout.sheetPaddingX,
    paddingBottom: 26,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.hairline,
    alignSelf: 'center',
    marginBottom: space.md,
  },
  toastBar: {
    minHeight: 64,
    borderRadius: radius.sheet,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairlineLit,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  toastMessage: {
    flex: 1,
  },
  listRowWrap: {
    width: '100%',
  },
  listRowPress: {
    minHeight: 56,
    paddingVertical: space.md,
    justifyContent: 'center',
  },
  listRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  rowLeading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTrailing: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.s2,
  },
  switchRow: {
    minHeight: 64,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  tile44: {
    width: 44,
    height: 44,
    borderRadius: radius.iconTile,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealRowCard: {
    paddingVertical: space.optical14,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    gap: space.md,
  },
  leaderboardCurrent: {
    backgroundColor: colors.s2,
    borderRadius: radius.input,
  },
  tabBarDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  tabGradientWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 104,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  tabPill: {
    flex: 1,
    height: 64,
    borderRadius: radius.tabBar,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    padding: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  tabSlot: {
    minWidth: 48,
    height: 48,
    borderRadius: radius.heroCard,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  tabSlotActive: {
    flex: 1,
    backgroundColor: colors.s3,
  },
  tabIconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 7,
    height: 7,
    borderRadius: radius.full,
    backgroundColor: colors.apricot,
  },
  notificationCard: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  notificationTile: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  notificationStack: {
    width: '100%',
    paddingTop: space.sm,
  },
  notificationPeek: {
    position: 'absolute',
    top: 0,
    left: space.lg,
    right: space.lg,
    height: space.lg,
    borderTopLeftRadius: radius.chip,
    borderTopRightRadius: radius.chip,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    opacity: 0.72,
  },
  notificationAppName: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  notificationTitle: {
    fontSize: 15,
  },
});
