/**
 * CaliPartner Design System v1 — ScreenTitle
 * Single source of truth: docs/ui/DESIGN_SYSTEM_V1.md (Section 3, 4 & 10)
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors, fonts, layout } from './theme';

export interface ScreenTitleProps {
  /** Optional uppercase Manrope eyebrow label (e.g. 'YOUR GOAL') */
  eyebrow?: string;
  /** Fraunces screen headline */
  title: string;
  /** At most ONE word in the headline rendered in Fraunces italic + apricot */
  accentWord?: string;
  /** Optional Manrope subtitle below headline */
  subtitle?: string;
  /** Headline scale token */
  size?: 'displayL' | 'title' | 'titleM' | 'titleS';
  /** Left aligned everywhere except celebration, big pickers, live cardio */
  align?: 'left' | 'center';
  /** Include standard 24 pt spacing below the title block before first control */
  spacingBottom?: number;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  testID?: string;
}

function splitAccentWord(title: string, accentWord?: string): [string, string, string] | null {
  if (!accentWord || !accentWord.trim()) return null;
  const trimmed = accentWord.trim();
  const index = title.indexOf(trimmed);
  if (index === -1) return null;
  return [title.slice(0, index), trimmed, title.slice(index + trimmed.length)];
}

/**
 * Standard screen heading hierarchy:
 * One eyebrow -> (+10 pt) -> One title with optional single apricot italic accent word ->
 * (+10 pt) -> One subtitle -> (+24 pt) -> content.
 */
export function ScreenTitle({
  eyebrow,
  title,
  accentWord,
  subtitle,
  size = 'title',
  align = 'left',
  spacingBottom = layout.subtitleToControl,
  style,
  titleStyle,
  testID,
}: ScreenTitleProps): React.JSX.Element {
  const parts = splitAccentWord(title, accentWord);
  const textAlign = align;
  const subtitleVariant = size === 'displayL' ? 'bodyL' : 'body';

  return (
    <View
      style={[
        styles.container,
        { marginBottom: spacingBottom, alignItems: align === 'center' ? 'center' : 'stretch' },
        style,
      ]}
      testID={testID}
    >
      {eyebrow ? (
        <Text
          variant="eyebrow"
          color="textLo"
          style={[styles.eyebrow, { textAlign }]}
          testID={testID ? `${testID}-eyebrow` : undefined}
        >
          {eyebrow}
        </Text>
      ) : null}

      <Text
        variant={size}
        color="textHi"
        accessibilityRole="header"
        style={[{ textAlign }, titleStyle]}
        testID={testID ? `${testID}-title` : undefined}
      >
        {parts ? (
          <>
            {parts[0]}
            <Text
              variant={size}
              italic
              color="apricot"
              style={[{ fontFamily: fonts.displayItalic, color: colors.apricot }, titleStyle]}
            >
              {parts[1]}
            </Text>
            {parts[2]}
          </>
        ) : (
          title
        )}
      </Text>

      {subtitle ? (
        <Text
          variant={subtitleVariant}
          color="textMid"
          style={[styles.subtitle, { textAlign }]}
          testID={testID ? `${testID}-subtitle` : undefined}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  eyebrow: {
    marginBottom: layout.eyebrowToTitle,
  },
  subtitle: {
    marginTop: layout.titleToSubtitle,
  },
});
