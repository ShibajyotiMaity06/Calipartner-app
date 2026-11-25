import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Card,
  QuantityButton,
  Text,
  borders,
  colors,
  fonts,
  radius,
  space,
  triggerHaptic,
} from '@calipartner/ui/v1';
import { t } from '@/i18n';

const STEP_PRESETS = [8000, 10000, 12000] as const;
const WATER_PRESETS = [2500, 3000, 3500] as const;

interface DailyTargetsStepProps {
  stepGoal: number;
  waterMlGoal: number;
  onChangeSteps: (steps: number) => void;
  onChangeWater: (waterMl: number) => void;
}

function TargetStepperCard({
  label,
  value,
  unit,
  presets,
  stepDelta,
  min,
  max,
  onChange,
  testIDPrefix,
}: {
  label: string;
  value: number;
  unit: string;
  presets: readonly number[];
  stepDelta: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  testIDPrefix: string;
}) {
  const safeVal = Number.isFinite(value) ? value : presets[0]!;

  return (
    <Card variant="default" style={styles.card} testID={`${testIDPrefix}-card`}>
      <Text variant="meta" color="textLo" style={styles.cardLabel}>
        {label}
      </Text>

      <View style={styles.valueRow}>
        <View style={styles.valueUnitRow}>
          <Text
            maxFontSizeMultiplier={1.2}
            tabular
            style={styles.bigValue}
            testID={`${testIDPrefix}-value`}
          >
            {safeVal.toLocaleString('en-US')}
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.unitLabel}>
            {unit}
          </Text>
        </View>

        <View style={styles.steppersRow}>
          <QuantityButton
            glyph="−"
            size={40}
            disabled={safeVal <= min}
            onPress={() => onChange(Math.max(min, safeVal - stepDelta))}
            accessibilityLabel={`${t('entryPolish.decrease', { label })}`}
            testID={`${testIDPrefix}-decrease`}
          />
          <QuantityButton
            glyph="+"
            size={40}
            disabled={safeVal >= max}
            onPress={() => onChange(Math.min(max, safeVal + stepDelta))}
            accessibilityLabel={`${t('entryPolish.increase', { label })}`}
            testID={`${testIDPrefix}-increase`}
          />
        </View>
      </View>

      <View style={styles.presetsRow}>
        {presets.map((preset) => {
          const selected = safeVal === preset;
          return (
            <Pressable
              key={preset}
              onPress={() => {
                triggerHaptic('selection');
                onChange(preset);
              }}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              testID={`${testIDPrefix}-preset-${preset}`}
              style={[
                styles.presetChip,
                selected ? styles.presetChipSelected : styles.presetChipDefault,
              ]}
            >
              <Text
                maxFontSizeMultiplier={1.2}
                tabular
                style={[
                  styles.presetText,
                  {
                    fontFamily: selected ? fonts.bold : fonts.semibold,
                    color: selected ? colors.textHi : colors.textLo,
                  },
                ]}
              >
                {preset.toLocaleString('en-US')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

export function DailyTargetsStep({
  stepGoal,
  waterMlGoal,
  onChangeSteps,
  onChangeWater,
}: DailyTargetsStepProps) {
  return (
    <View style={styles.stack} testID="daily-targets-step">
      <TargetStepperCard
        label={t('onboardingV1.dailyStepsLabel')}
        value={stepGoal}
        unit={t('onboardingV1.dailyStepsUnit')}
        presets={STEP_PRESETS}
        stepDelta={500}
        min={1000}
        max={100000}
        onChange={onChangeSteps}
        testIDPrefix="input-step-goal"
      />
      <TargetStepperCard
        label={t('onboardingV1.dailyWaterLabel')}
        value={waterMlGoal}
        unit={t('onboardingV1.dailyWaterUnit')}
        presets={WATER_PRESETS}
        stepDelta={250}
        min={250}
        max={20000}
        onChange={onChangeWater}
        testIDPrefix="input-water-goal"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: space.lg,
  },
  card: {
    padding: space.lg,
  },
  cardLabel: {
    marginBottom: space.sm,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  valueUnitRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 1,
  },
  bigValue: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1.1,
    color: colors.textHi,
  },
  unitLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 16,
    color: colors.textLo,
    marginLeft: space.xs + 2,
  },
  steppersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.md,
  },
  presetChip: {
    paddingVertical: space.xs + 2,
    paddingHorizontal: space.optical14,
    borderRadius: radius.full,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetChipDefault: {
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
  },
  presetChipSelected: {
    backgroundColor: colors.s3,
    borderWidth: borders.width,
    borderColor: colors.hairlineLit,
  },
  presetText: {
    fontSize: 13,
    lineHeight: 16,
  },
});
