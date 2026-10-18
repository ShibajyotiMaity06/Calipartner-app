import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface RecipeServingsScalerProps {
  servings: number;
  onServingsChange: (next: number) => void;
  minServings?: number;
  maxServings?: number;
}

export function RecipeServingsScaler({
  servings,
  onServingsChange,
  minServings = 1,
  maxServings = 20,
}: RecipeServingsScalerProps) {
  const { colors } = useTheme();

  const canDecrement = servings > minServings;
  const canIncrement = servings < maxServings;

  const handleDecrement = () => {
    if (canDecrement) {
      onServingsChange(Math.max(minServings, servings - 1));
    }
  };

  const handleIncrement = () => {
    if (canIncrement) {
      onServingsChange(Math.min(maxServings, servings + 1));
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
    >
      <View style={styles.topRow}>
        <View style={styles.labelWrap}>
          <Ionicons name="people-outline" size={18} color={colors.accent} />
          <Text style={[styles.label, { color: colors.text }]}>
            {t('recipes.detail.servingsLabel')}
          </Text>
        </View>

        {/* Stepper Buttons */}
        <View
          style={[
            styles.stepperWrap,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Pressable
            testID="btn-servings-dec"
            onPress={handleDecrement}
            disabled={!canDecrement}
            accessibilityRole="button"
            accessibilityLabel="Decrease servings"
            accessibilityState={{ disabled: !canDecrement }}
            style={({ pressed }) => [
              styles.stepBtn,
              { opacity: !canDecrement ? 0.35 : pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="remove" size={18} color={colors.text} />
          </Pressable>

          <View style={styles.valueWrap}>
            <Text testID="text-servings-count" style={[styles.valueText, { color: colors.text }]}>
              {servings}
            </Text>
          </View>

          <Pressable
            testID="btn-servings-inc"
            onPress={handleIncrement}
            disabled={!canIncrement}
            accessibilityRole="button"
            accessibilityLabel="Increase servings"
            accessibilityState={{ disabled: !canIncrement }}
            style={({ pressed }) => [
              styles.stepBtn,
              { opacity: !canIncrement ? 0.35 : pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="add" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <Text style={[styles.hintText, { color: colors.textMuted }]}>
        {t('recipes.detail.servingsScalerHint')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stepBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueWrap: {
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  hintText: {
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
});
