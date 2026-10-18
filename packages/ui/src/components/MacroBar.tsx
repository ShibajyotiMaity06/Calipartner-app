import React from 'react';
import { View, StyleSheet, type AccessibilityProps } from 'react-native';
import { dark, type IdentityHue, getIdentityColor } from '../tokens/colors';
import { space } from '../tokens/space';
import { Text } from './Text';

export interface MacroBarProps extends AccessibilityProps {
  /** Protein in grams */
  proteinGrams: number;
  /** Carbs in grams */
  carbsGrams: number;
  /** Fat in grams */
  fatGrams: number;
  /** Protein target in grams (optional) */
  proteinTargetGrams?: number;
  /** Carbs target in grams (optional) */
  carbsTargetGrams?: number;
  /** Fat target in grams (optional) */
  fatTargetGrams?: number;
  /** Owner identity hue (default 'iris') */
  identityHue?: IdentityHue;
  /** Bar height. Default 10 */
  height?: number;
  /** Custom test ID */
  testID?: string;
}

export function MacroBar({
  proteinGrams,
  carbsGrams,
  fatGrams,
  proteinTargetGrams,
  carbsTargetGrams,
  fatTargetGrams,
  identityHue = 'iris',
  height = 10,
  testID = 'macro-bar',
  accessibilityLabel,
  ...rest
}: MacroBarProps): React.JSX.Element {
  const baseColor = getIdentityColor(identityHue);

  const a11y =
    accessibilityLabel ||
    `Macros: Protein ${proteinGrams} grams, Carbs ${carbsGrams} grams, Fat ${fatGrams} grams.`;

  return (
    <View
      style={styles.container}
      testID={testID}
      accessibilityRole="summary"
      accessibilityLabel={a11y}
      {...rest}
    >
      {/* 1. Proportional Macro Stack Bar */}
      <View style={[styles.barTrack, { height, borderRadius: height / 2 }]}>
        {proteinGrams > 0 && (
          <View
            style={[
              styles.barSegment,
              {
                flex: proteinGrams,
                backgroundColor: baseColor, // 100% identity step
              },
            ]}
          />
        )}
        {carbsGrams > 0 && (
          <View
            style={[
              styles.barSegment,
              {
                flex: carbsGrams,
                backgroundColor: baseColor,
                opacity: 0.55, // 55% identity step (Spec CMP-13)
              },
            ]}
          />
        )}
        {fatGrams > 0 && (
          <View
            style={[
              styles.barSegment,
              {
                flex: fatGrams,
                backgroundColor: baseColor,
                opacity: 0.28, // 28% identity step (Spec CMP-13)
              },
            ]}
          />
        )}
      </View>

      {/* 2. Gram values and labels under (Spec CMP-13) */}
      <View style={styles.metricsRow}>
        {/* Protein */}
        <View style={styles.macroColumn}>
          <View style={styles.indicatorRow}>
            <View style={[styles.colorDot, { backgroundColor: baseColor }]} />
            <Text variant="label" color={dark.textMid}>
              Protein
            </Text>
          </View>
          <Text variant="heading" color={dark.textHi}>
            {`${Math.round(proteinGrams)}g`}
          </Text>
          {proteinTargetGrams != null && (
            <Text variant="micro" color={dark.textLo}>
              {`/ ${Math.round(proteinTargetGrams)}g`}
            </Text>
          )}
        </View>

        {/* Carbs */}
        <View style={styles.macroColumn}>
          <View style={styles.indicatorRow}>
            <View style={[styles.colorDot, { backgroundColor: baseColor, opacity: 0.55 }]} />
            <Text variant="label" color={dark.textMid}>
              Carbs
            </Text>
          </View>
          <Text variant="heading" color={dark.textHi}>
            {`${Math.round(carbsGrams)}g`}
          </Text>
          {carbsTargetGrams != null && (
            <Text variant="micro" color={dark.textLo}>
              {`/ ${Math.round(carbsTargetGrams)}g`}
            </Text>
          )}
        </View>

        {/* Fat */}
        <View style={styles.macroColumn}>
          <View style={styles.indicatorRow}>
            <View style={[styles.colorDot, { backgroundColor: baseColor, opacity: 0.28 }]} />
            <Text variant="label" color={dark.textMid}>
              Fat
            </Text>
          </View>
          <Text variant="heading" color={dark.textHi}>
            {`${Math.round(fatGrams)}g`}
          </Text>
          {fatTargetGrams != null && (
            <Text variant="micro" color={dark.textLo}>
              {`/ ${Math.round(fatTargetGrams)}g`}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: space[3],
  },
  barTrack: {
    width: '100%',
    backgroundColor: dark.s2,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  barSegment: {
    height: '100%',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  macroColumn: {
    gap: 2,
    alignItems: 'flex-start',
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
