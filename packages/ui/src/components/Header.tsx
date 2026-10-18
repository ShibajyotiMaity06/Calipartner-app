import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { dark } from '../tokens/colors';
import { space } from '../tokens/space';
import { ChevronLeftIcon } from './Icons';

export interface HeaderProps {
  /** Main screen title */
  title: string;
  /** Optional secondary subtitle */
  subtitle?: string;
  /** Whether to render a prominent large title (standard for tab roots) */
  largeTitle?: boolean;
  /** Whether to display a standard back button */
  showBack?: boolean;
  /** Callback for back press */
  onBack?: () => void;
  /** Accessibility label for back button */
  backAccessibilityLabel?: string;
  /** Optional custom left element (replaces standard back if provided) */
  leftAction?: React.ReactNode;
  /** Optional trailing action buttons (e.g. settings, notifications) */
  rightActions?: React.ReactNode;
  /** Whether to show a 1px hairline bottom separator */
  borderBottom?: boolean;
  /** Custom background color (defaults to transparent) */
  backgroundColor?: string;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Test identifier */
  testID?: string;
}

export function Header({
  title,
  subtitle,
  largeTitle = false,
  showBack = false,
  onBack,
  backAccessibilityLabel = 'Go back',
  leftAction,
  rightActions,
  borderBottom = false,
  backgroundColor = 'transparent',
  style,
  testID = 'screen-header',
}: HeaderProps): React.JSX.Element {
  return (
    <View
      testID={testID}
      style={[styles.container, { backgroundColor }, borderBottom && styles.bottomBorder, style]}
      accessibilityRole="header"
    >
      {/* Top action row */}
      <View style={styles.topRow}>
        <View style={styles.leftSlot}>
          {leftAction ? (
            leftAction
          ) : showBack && onBack ? (
            <TouchableOpacity
              testID="btn-header-back"
              accessibilityRole="button"
              accessibilityLabel={backAccessibilityLabel}
              style={styles.backButton}
              activeOpacity={0.7}
              onPress={onBack}
            >
              <ChevronLeftIcon size={24} color={dark.textHi} strokeWidth={2} />
            </TouchableOpacity>
          ) : null}
        </View>

        {!largeTitle && (
          <View style={styles.centerSlot}>
            <Text numberOfLines={1} style={styles.standardTitle}>
              {title}
            </Text>
            {subtitle ? (
              <Text numberOfLines={1} style={styles.standardSubtitle}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        )}

        <View style={styles.rightSlot}>{rightActions ?? null}</View>
      </View>

      {/* Prominent large title for tab roots */}
      {largeTitle && (
        <View style={styles.largeTitleSlot}>
          <Text style={styles.largeTitleText} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.largeSubtitleText}>{subtitle}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: space[4], // 16
    paddingTop: space[2], // 8
    paddingBottom: space[2], // 8
  },
  bottomBorder: {
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
  },
  topRow: {
    minHeight: 44, // Minimum 44 hit area requirement
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSlot: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -space[2], // -8 to align chevron nicely with screen margin
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[2], // 8
  },
  standardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: dark.textHi,
    textAlign: 'center',
  },
  standardSubtitle: {
    fontSize: 12,
    color: dark.textMid,
    marginTop: 2,
    textAlign: 'center',
  },
  rightSlot: {
    minWidth: 44,
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  largeTitleSlot: {
    marginTop: space[3], // 12
    marginBottom: space[2], // 8
    paddingHorizontal: space[1], // 4
  },
  largeTitleText: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    color: dark.textHi,
    letterSpacing: -0.5,
  },
  largeSubtitleText: {
    fontSize: 13,
    color: dark.textMid,
    marginTop: space[1], // 4
  },
});
