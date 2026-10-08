import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  cmToFtIn,
  ftInToCm,
  kgToLb,
  lbToKg,
  type Goal,
  type Sex,
  type Units,
} from '@calipartner/core';
import { InteractiveDobPicker } from '@/components/onboarding/InteractiveDobPicker';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface BodyStatsStepProps {
  units: Units;
  sex: Sex;
  dateOfBirth: string;
  heightCm: number;
  weightKg: number;
  bodyFatPercentage: number | null;
  goal: Goal;
  errorDateOfBirth?: string;
  errorHeight?: string;
  errorWeight?: string;
  errorBodyFat?: string;
  onChangeUnits: (units: Units) => void;
  onChangeSex: (sex: Sex) => void;
  onChangeDateOfBirth: (dob: string) => void;
  onChangeHeightCm: (heightCm: number) => void;
  onChangeWeightKg: (weightKg: number) => void;
  onChangeBodyFat: (bodyFat: number | null) => void;
}

export function BodyStatsStep({
  units,
  sex,
  dateOfBirth,
  heightCm,
  weightKg,
  bodyFatPercentage,
  goal,
  errorDateOfBirth,
  errorHeight,
  errorWeight,
  errorBodyFat,
  onChangeUnits,
  onChangeSex,
  onChangeDateOfBirth,
  onChangeHeightCm,
  onChangeWeightKg,
  onChangeBodyFat,
}: BodyStatsStepProps) {
  const { colors } = useTheme();

  // Local text input states so user can type freely
  const [heightCmText, setHeightCmText] = useState(heightCm > 0 ? String(heightCm) : '');
  const [weightText, setWeightText] = useState(
    weightKg > 0
      ? units === 'metric'
        ? String(weightKg)
        : String(Math.round(kgToLb(weightKg) * 10) / 10)
      : '',
  );
  const [bodyFatText, setBodyFatText] = useState(
    bodyFatPercentage !== null ? String(bodyFatPercentage) : '',
  );

  // Imperial feet & inches
  const imperialFtIn = useMemo(() => cmToFtIn(heightCm || 175), [heightCm]);
  const [feetText, setFeetText] = useState(String(imperialFtIn.feet));
  const [inchesText, setInchesText] = useState(String(imperialFtIn.inches));

  // Sync when units toggle changes
  const handleToggleUnits = (nextUnits: Units) => {
    playClickSound();
    if (nextUnits === units) return;
    onChangeUnits(nextUnits);
    if (nextUnits === 'imperial') {
      const ftIn = cmToFtIn(heightCm || 175);
      setFeetText(String(ftIn.feet));
      setInchesText(String(ftIn.inches));
      const convertedLb = Math.round(kgToLb(weightKg || 70) * 10) / 10;
      setWeightText(String(convertedLb));
    } else {
      setHeightCmText(String(Math.round(heightCm || 175)));
      setWeightText(String(Math.round((weightKg || 70) * 10) / 10));
    }
  };

  // Height change handlers
  const handleMetricHeightChange = (text: string) => {
    setHeightCmText(text);
    const parsed = parseFloat(text);
    if (!isNaN(parsed) && parsed > 0) {
      onChangeHeightCm(parsed);
    }
  };

  const handleImperialFeetChange = (ftText: string) => {
    setFeetText(ftText);
    const ft = parseInt(ftText, 10) || 0;
    const inch = parseInt(inchesText, 10) || 0;
    const cm = Math.round(ftInToCm(ft, inch));
    onChangeHeightCm(cm);
  };

  const handleImperialInchesChange = (inchText: string) => {
    setInchesText(inchText);
    const ft = parseInt(feetText, 10) || 0;
    const inch = parseInt(inchText, 10) || 0;
    const cm = Math.round(ftInToCm(ft, inch));
    onChangeHeightCm(cm);
  };

  // Weight change handler
  const handleWeightChange = (text: string) => {
    setWeightText(text);
    const parsed = parseFloat(text);
    if (!isNaN(parsed) && parsed > 0) {
      const kg = units === 'metric' ? parsed : lbToKg(parsed);
      onChangeWeightKg(Math.round(kg * 100) / 100);
    }
  };

  // Body fat change handler
  const handleBodyFatChange = (text: string) => {
    setBodyFatText(text);
    if (text.trim() === '') {
      onChangeBodyFat(null);
      return;
    }
    const parsed = parseFloat(text);
    if (!isNaN(parsed)) {
      onChangeBodyFat(parsed);
    }
  };

  // Calculate live BMI
  const bmiInfo = useMemo(() => {
    if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    const rounded = Math.round(bmi * 10) / 10;

    let category = t('onboarding.bodyStats.bmiCategoryNormal');
    if (rounded < 18.5) {
      category = t('onboarding.bodyStats.bmiCategoryUnderweight');
    } else if (rounded >= 25 && rounded < 30) {
      category = t('onboarding.bodyStats.bmiCategoryOverweight');
    } else if (rounded >= 30) {
      category = t('onboarding.bodyStats.bmiCategoryObese');
    }

    const isCutUnderweight = rounded < 18.5 && goal === 'cut';

    return { value: rounded, category, isCutUnderweight };
  }, [heightCm, weightKg, goal]);

  return (
    <View style={styles.container}>
      {/* Units Segmented Toggle */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>
          {t('onboarding.bodyStats.unitsLabel')}
        </Text>
        <View
          style={[styles.segmentContainer, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          accessible
          accessibilityRole="radiogroup"
        >
          <Pressable
            testID="units-toggle-metric"
            accessibilityRole="radio"
            accessibilityState={{ selected: units === 'metric' }}
            accessibilityLabel={t('onboarding.bodyStats.metric')}
            onPress={() => handleToggleUnits('metric')}
            style={[
              styles.segmentItem,
              units === 'metric' && [styles.segmentActive, { backgroundColor: colors.surface }],
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: units === 'metric' ? colors.text : colors.textMuted },
                units === 'metric' && styles.segmentTextBold,
              ]}
            >
              {t('onboarding.bodyStats.metric')}
            </Text>
          </Pressable>

          <Pressable
            testID="units-toggle-imperial"
            accessibilityRole="radio"
            accessibilityState={{ selected: units === 'imperial' }}
            accessibilityLabel={t('onboarding.bodyStats.imperial')}
            onPress={() => handleToggleUnits('imperial')}
            style={[
              styles.segmentItem,
              units === 'imperial' && [styles.segmentActive, { backgroundColor: colors.surface }],
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: units === 'imperial' ? colors.text : colors.textMuted },
                units === 'imperial' && styles.segmentTextBold,
              ]}
            >
              {t('onboarding.bodyStats.imperial')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Sex Chips */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>
          {t('onboarding.bodyStats.sexLabel')}
        </Text>
        <Text style={[styles.helpText, { color: colors.textMuted }]}>
          {t('onboarding.bodyStats.sexHelp')}
        </Text>
        <View style={styles.chipsRow} accessible accessibilityRole="radiogroup">
          {(['male', 'female', 'other'] as const).map((s) => {
            const isSelected = sex === s;
            return (
              <Pressable
                key={s}
                testID={`sex-chip-${s}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={t(`onboarding.bodyStats.${s}`)}
                onPress={() => {
                  playClickSound();
                  onChangeSex(s);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected ? colors.surface : colors.surfaceAlt,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: isSelected ? colors.text : colors.textMuted },
                    isSelected && styles.chipTextBold,
                  ]}
                >
                  {t(`onboarding.bodyStats.${s}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Interactive Date of Birth Picker */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>
          {t('onboarding.bodyStats.dobLabel')}
        </Text>
        <InteractiveDobPicker
          value={dateOfBirth}
          onChange={onChangeDateOfBirth}
          error={errorDateOfBirth}
        />
      </View>

      {/* Height Input (cm vs ft/in) */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>
          {t('onboarding.bodyStats.heightLabel')} ({units === 'metric' ? 'cm' : 'ft & in'})
        </Text>
        {units === 'metric' ? (
          <TextInput
            testID="input-height"
            value={heightCmText}
            onChangeText={handleMetricHeightChange}
            placeholder={t('onboarding.bodyStats.heightCmPlaceholder')}
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            accessibilityLabel={`${t('onboarding.bodyStats.heightLabel')} in centimeters`}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: errorHeight ? colors.danger : colors.border,
                color: colors.text,
              },
            ]}
          />
        ) : (
          <View style={styles.dualInputRow}>
            <View style={styles.dualInputItem}>
              <TextInput
                testID="input-height-ft"
                value={feetText}
                onChangeText={handleImperialFeetChange}
                placeholder={t('onboarding.bodyStats.heightFtPlaceholder')}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                accessibilityLabel="Height in feet"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: errorHeight ? colors.danger : colors.border,
                    color: colors.text,
                  },
                ]}
              />
              <Text style={[styles.unitSuffix, { color: colors.textMuted }]}>ft</Text>
            </View>
            <View style={styles.dualInputItem}>
              <TextInput
                testID="input-height-in"
                value={inchesText}
                onChangeText={handleImperialInchesChange}
                placeholder={t('onboarding.bodyStats.heightInPlaceholder')}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                accessibilityLabel="Height in inches"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: errorHeight ? colors.danger : colors.border,
                    color: colors.text,
                  },
                ]}
              />
              <Text style={[styles.unitSuffix, { color: colors.textMuted }]}>in</Text>
            </View>
          </View>
        )}
        {errorHeight ? (
          <Text style={[styles.errorText, { color: colors.danger }]} testID="error-height">
            {errorHeight}
          </Text>
        ) : null}
      </View>

      {/* Weight Input (kg vs lb) */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>
          {t('onboarding.bodyStats.weightLabel')} ({units === 'metric' ? 'kg' : 'lb'})
        </Text>
        <TextInput
          testID="input-weight"
          value={weightText}
          onChangeText={handleWeightChange}
          placeholder={t('onboarding.bodyStats.weightPlaceholder')}
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          accessibilityLabel={`${t('onboarding.bodyStats.weightLabel')} in ${units === 'metric' ? 'kilograms' : 'pounds'}`}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: errorWeight ? colors.danger : colors.border,
              color: colors.text,
            },
          ]}
        />
        {errorWeight ? (
          <Text style={[styles.errorText, { color: colors.danger }]} testID="error-weight">
            {errorWeight}
          </Text>
        ) : null}
      </View>

      {/* Optional Body Fat % */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>
          {t('onboarding.bodyStats.bodyFatLabel')}
        </Text>
        <TextInput
          testID="input-body-fat"
          value={bodyFatText}
          onChangeText={handleBodyFatChange}
          placeholder={t('onboarding.bodyStats.bodyFatPlaceholder')}
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          accessibilityLabel={t('onboarding.bodyStats.bodyFatLabel')}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: errorBodyFat ? colors.danger : colors.border,
              color: colors.text,
            },
          ]}
        />
        {errorBodyFat ? (
          <Text style={[styles.errorText, { color: colors.danger }]} testID="error-body-fat">
            {errorBodyFat}
          </Text>
        ) : (
          <Text style={[styles.helpText, { color: colors.textMuted }]}>
            {t('onboarding.bodyStats.bodyFatHelp')}
          </Text>
        )}
      </View>

      {/* Live BMI Banner */}
      {bmiInfo ? (
        <View
          style={[
            styles.bmiCard,
            {
              backgroundColor: colors.surfaceAlt,
              borderColor: bmiInfo.isCutUnderweight ? colors.danger : colors.border,
            },
          ]}
          testID="bmi-indicator-card"
        >
          <View style={styles.bmiRow}>
            <Text style={[styles.bmiLabel, { color: colors.text }]}>
              {t('onboarding.bodyStats.bmiLabel')}:{' '}
              <Text style={{ fontWeight: '700' }}>{bmiInfo.value}</Text>
            </Text>
            <View
              style={[
                styles.bmiBadge,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.bmiBadgeText, { color: colors.textMuted }]}>
                {bmiInfo.category}
              </Text>
            </View>
          </View>
          {bmiInfo.isCutUnderweight && (
            <Text style={[styles.bmiWarning, { color: colors.danger }]} testID="bmi-cut-warning">
              {t('onboarding.bodyStats.bmiCutWarning')}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  section: {
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  helpText: {
    fontSize: fontSize.sm - 1,
    lineHeight: 18,
  },
  errorText: {
    fontSize: fontSize.sm - 1,
    fontWeight: '500',
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
    minHeight: 44,
  },
  segmentItem: {
    flex: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  segmentActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: fontSize.sm,
  },
  segmentTextBold: {
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  chipText: {
    fontSize: fontSize.sm,
  },
  chipTextBold: {
    fontWeight: '600',
  },
  dualInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dualInputItem: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  unitSuffix: {
    position: 'absolute',
    right: spacing.md,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  bmiCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  bmiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bmiLabel: {
    fontSize: fontSize.sm,
  },
  bmiBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  bmiBadgeText: {
    fontSize: fontSize.sm - 2,
    fontWeight: '600',
  },
  bmiWarning: {
    fontSize: fontSize.sm - 1,
    lineHeight: 18,
    fontWeight: '500',
  },
});
