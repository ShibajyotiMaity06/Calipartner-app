import React, { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View, TouchableOpacity } from 'react-native';
import {
  cmToFtIn,
  ftInToCm,
  kgToLb,
  lbToKg,
  type Goal,
  type Sex,
  type Units,
} from '@calipartner/core';
import { Text, space, dark, radius } from '@calipartner/ui';
import { InteractiveDobPicker } from '@/components/onboarding/InteractiveDobPicker';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';

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
        <Text variant="label" color={dark.textLo} style={styles.sectionLabel}>
          {t('onboarding.bodyStats.unitsLabel')}
        </Text>
        <View style={styles.segmentContainer} accessible accessibilityRole="radiogroup">
          <TouchableOpacity
            testID="units-toggle-metric"
            accessibilityRole="radio"
            accessibilityState={{ selected: units === 'metric' }}
            accessibilityLabel={t('onboarding.bodyStats.metric')}
            onPress={() => handleToggleUnits('metric')}
            style={[
              styles.segmentItem,
              units === 'metric' && styles.segmentActive,
            ]}
          >
            <Text
              variant="bodyS"
              color={units === 'metric' ? dark.textHi : dark.textLo}
              style={units === 'metric' ? styles.segmentTextBold : undefined}
            >
              {t('onboarding.bodyStats.metric')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="units-toggle-imperial"
            accessibilityRole="radio"
            accessibilityState={{ selected: units === 'imperial' }}
            accessibilityLabel={t('onboarding.bodyStats.imperial')}
            onPress={() => handleToggleUnits('imperial')}
            style={[
              styles.segmentItem,
              units === 'imperial' && styles.segmentActive,
            ]}
          >
            <Text
              variant="bodyS"
              color={units === 'imperial' ? dark.textHi : dark.textLo}
              style={units === 'imperial' ? styles.segmentTextBold : undefined}
            >
              {t('onboarding.bodyStats.imperial')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sex Chips */}
      <View style={styles.section}>
        <Text variant="label" color={dark.textLo} style={styles.sectionLabel}>
          {t('onboarding.bodyStats.sexLabel')}
        </Text>
        <Text variant="bodyS" color={dark.textMid} style={styles.helpText}>
          {t('onboarding.bodyStats.sexHelp')}
        </Text>
        <View style={styles.chipsRow} accessible accessibilityRole="radiogroup">
          {(['male', 'female', 'other'] as const).map((s) => {
            const isSelected = sex === s;
            return (
              <TouchableOpacity
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
                    backgroundColor: isSelected ? dark.s2 : dark.s1,
                    borderColor: isSelected ? dark.apricot : dark.hairline,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                <Text
                  variant="body"
                  color={isSelected ? dark.textHi : dark.textMid}
                  style={isSelected ? styles.chipTextBold : undefined}
                >
                  {t(`onboarding.bodyStats.${s}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Interactive Date of Birth Picker */}
      <View style={styles.section}>
        <Text variant="label" color={dark.textLo} style={styles.sectionLabel}>
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
        <Text variant="label" color={dark.textLo} style={styles.sectionLabel}>
          {t('onboarding.bodyStats.heightLabel')} ({units === 'metric' ? 'cm' : 'ft & in'})
        </Text>
        {units === 'metric' ? (
          <TextInput
            testID="input-height"
            value={heightCmText}
            onChangeText={handleMetricHeightChange}
            placeholder={t('onboarding.bodyStats.heightCmPlaceholder')}
            placeholderTextColor={dark.textOff}
            keyboardType="numeric"
            accessibilityLabel={`${t('onboarding.bodyStats.heightLabel')} in centimeters`}
            style={[
              styles.input,
              {
                backgroundColor: dark.s2,
                borderColor: errorHeight ? dark.danger : dark.hairline,
                color: dark.textHi,
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
                placeholderTextColor={dark.textOff}
                keyboardType="numeric"
                accessibilityLabel="Height in feet"
                style={[
                  styles.input,
                  {
                    backgroundColor: dark.s2,
                    borderColor: errorHeight ? dark.danger : dark.hairline,
                    color: dark.textHi,
                  },
                ]}
              />
              <Text variant="bodyS" color={dark.textMid} style={styles.unitSuffix}>
                ft
              </Text>
            </View>
            <View style={styles.dualInputItem}>
              <TextInput
                testID="input-height-in"
                value={inchesText}
                onChangeText={handleImperialInchesChange}
                placeholder={t('onboarding.bodyStats.heightInPlaceholder')}
                placeholderTextColor={dark.textOff}
                keyboardType="numeric"
                accessibilityLabel="Height in inches"
                style={[
                  styles.input,
                  {
                    backgroundColor: dark.s2,
                    borderColor: errorHeight ? dark.danger : dark.hairline,
                    color: dark.textHi,
                  },
                ]}
              />
              <Text variant="bodyS" color={dark.textMid} style={styles.unitSuffix}>
                in
              </Text>
            </View>
          </View>
        )}
        {errorHeight ? (
          <Text variant="label" color={dark.danger} testID="error-height">
            {errorHeight}
          </Text>
        ) : null}
      </View>

      {/* Weight Input (kg vs lb) */}
      <View style={styles.section}>
        <Text variant="label" color={dark.textLo} style={styles.sectionLabel}>
          {t('onboarding.bodyStats.weightLabel')} ({units === 'metric' ? 'kg' : 'lb'})
        </Text>
        <TextInput
          testID="input-weight"
          value={weightText}
          onChangeText={handleWeightChange}
          placeholder={t('onboarding.bodyStats.weightPlaceholder')}
          placeholderTextColor={dark.textOff}
          keyboardType="numeric"
          accessibilityLabel={`${t('onboarding.bodyStats.weightLabel')} in ${units === 'metric' ? 'kilograms' : 'pounds'}`}
          style={[
            styles.input,
            {
              backgroundColor: dark.s2,
              borderColor: errorWeight ? dark.danger : dark.hairline,
              color: dark.textHi,
            },
          ]}
        />
        {errorWeight ? (
          <Text variant="label" color={dark.danger} testID="error-weight">
            {errorWeight}
          </Text>
        ) : null}
      </View>

      {/* Optional Body Fat % */}
      <View style={styles.section}>
        <Text variant="label" color={dark.textLo} style={styles.sectionLabel}>
          {t('onboarding.bodyStats.bodyFatLabel')}
        </Text>
        <TextInput
          testID="input-body-fat"
          value={bodyFatText}
          onChangeText={handleBodyFatChange}
          placeholder={t('onboarding.bodyStats.bodyFatPlaceholder')}
          placeholderTextColor={dark.textOff}
          keyboardType="numeric"
          accessibilityLabel={t('onboarding.bodyStats.bodyFatLabel')}
          style={[
            styles.input,
            {
              backgroundColor: dark.s2,
              borderColor: errorBodyFat ? dark.danger : dark.hairline,
              color: dark.textHi,
            },
          ]}
        />
        {errorBodyFat ? (
          <Text variant="label" color={dark.danger} testID="error-body-fat">
            {errorBodyFat}
          </Text>
        ) : (
          <Text variant="label" color={dark.textLo} style={styles.helpText}>
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
              borderColor: bmiInfo.isCutUnderweight ? dark.danger : dark.hairline,
            },
          ]}
          testID="bmi-indicator-card"
        >
          <View style={styles.bmiRow}>
            <Text variant="body" color={dark.textHi}>
              {t('onboarding.bodyStats.bmiLabel')}:{' '}
              <Text variant="body" color={dark.textHi} style={{ fontWeight: '700' }}>
                {bmiInfo.value}
              </Text>
            </Text>
            <View style={styles.bmiBadge}>
              <Text variant="label" color={dark.textMid}>
                {bmiInfo.category}
              </Text>
            </View>
          </View>
          {bmiInfo.isCutUnderweight && (
            <Text variant="label" color={dark.danger} testID="bmi-cut-warning">
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
    paddingHorizontal: space[4],
    gap: space[4],
    paddingTop: space[2],
  },
  section: {
    gap: space[1],
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  helpText: {
    lineHeight: 18,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space[3],
    fontSize: 16,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    padding: 3,
    minHeight: 44,
  },
  segmentItem: {
    flex: 1,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[2],
    minHeight: 40,
  },
  segmentActive: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
  segmentTextBold: {
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  chip: {
    flex: 1,
    borderRadius: radius.full,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[2],
  },
  chipTextBold: {
    fontWeight: '600',
  },
  dualInputRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  dualInputItem: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  unitSuffix: {
    position: 'absolute',
    right: space[3],
    fontWeight: '500',
  },
  bmiCard: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space[3],
    gap: space[1],
  },
  bmiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bmiBadge: {
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.full,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
});
