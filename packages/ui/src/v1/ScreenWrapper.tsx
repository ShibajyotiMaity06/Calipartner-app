/**
 * CaliPartner Design System v1 — Safe Area Screen Wrapper
 * Single source of truth: docs/ui/DESIGN_SYSTEM_V1.md (Section 4 & 10)
 */
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, space } from './theme';

function useSafeInsetsFallback() {
  try {
    return useSafeAreaInsets();
  } catch {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
}

export interface ScreenWrapperProps {
  children: React.ReactNode;
  /** Optional 44 pt navigation row rendered above the 28 pt title spacer */
  navRow?: React.ReactNode;
  /** Optional sticky footer (e.g. primary CTA) anchored at max(34, safeAreaBottom) */
  footer?: React.ReactNode;
  /** Wrap content in a ScrollView */
  scroll?: boolean;
  /** Add >= 150 pt bottom clearance above the floating tab bar */
  hasTabBar?: boolean;
  /** Apply default 24 pt horizontal screen padding */
  padded?: boolean;
  /** Offset top content under status bar (safe area top + 12) */
  safeTop?: boolean;
  /** Enable KeyboardAvoidingView behavior on iOS */
  keyboardAvoiding?: boolean;
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle' | 'style'>;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Root Design System v1 safe-area screen shell:
 * - Warm dark bg0 (#0E0B08) background
 * - 24 pt horizontal side padding
 * - safe area top + 12 pt top spacing
 * - 44 pt nav row with 28 pt gap before ScreenTitle
 * - max(34, safeAreaBottom) CTA floor or >= 150 pt scroll clearance above tab bar
 */
export function ScreenWrapper({
  children,
  navRow,
  footer,
  scroll = false,
  hasTabBar = false,
  padded = true,
  safeTop = true,
  keyboardAvoiding = false,
  scrollProps,
  style,
  contentStyle,
  testID,
}: ScreenWrapperProps): React.JSX.Element {
  const insets = useSafeInsetsFallback();

  const paddingTop = safeTop ? insets.top + layout.topContentOffset : 0;
  const paddingHorizontal = padded ? layout.screenPaddingX : 0;
  const ctaBottomPadding = Math.max(layout.ctaBottomMin, insets.bottom);
  const bottomContentPadding = hasTabBar
    ? Math.max(layout.tabBarClearance, insets.bottom + layout.tabBarClearance)
    : footer
      ? space.lg
      : ctaBottomPadding;

  const navBlock = navRow ? (
    <View style={[styles.navRow, { paddingHorizontal }]}>{navRow}</View>
  ) : null;

  const body = scroll ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      {...scrollProps}
      style={styles.flex}
      contentContainerStyle={[
        {
          flexGrow: 1,
          paddingHorizontal,
          paddingTop: navRow ? layout.navToTitle : 0,
          paddingBottom: bottomContentPadding,
        },
        contentStyle,
      ]}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.flex,
        {
          paddingHorizontal,
          paddingTop: navRow ? layout.navToTitle : 0,
          paddingBottom: footer ? 0 : bottomContentPadding,
        },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  const inner = (
    <View style={[styles.root, { paddingTop }, style]} testID={testID}>
      {navBlock}
      {body}
      {footer ? (
        <View style={[styles.footer, { paddingHorizontal, paddingBottom: ctaBottomPadding }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );

  if (keyboardAvoiding) {
    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {inner}
      </KeyboardAvoidingView>
    );
  }

  return inner;
}

export const SafeScreen = ScreenWrapper;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  flex: {
    flex: 1,
  },
  navRow: {
    minHeight: layout.navRowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footer: {
    paddingTop: space.lg,
    gap: space.md,
  },
});
