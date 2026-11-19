import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  calculateAge,
  cmToFtIn,
  ftInToCm,
  kgToLb,
  lbToKg,
  type Goal,
  type Sex,
  type Units,
} from '@calipartner/core';
import { SegmentedControl, Text, space, useTheme } from '@calipartner/ui';
import { CompactSelect } from '@/components/CompactSelect';
import { t } from '@/i18n';
import { PlanCard, PlanTextField, planStyles } from './PlanPrimitives';
import { StatsPicker } from './StatsPicker';

interface BodyStatsStepProps {
  units: Units;
  heightUnits?: Units;
  nickname?: string;
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
  identityConfirmed?: boolean;
  onChangeUnits: (units: Units) => void;
  onChangeHeightUnits?: (units: Units) => void;
  onChangeNickname?: (nickname: string) => void;
  onChangeSex: (sex: Sex) => void;
  onChangeDateOfBirth: (dob: string) => void;
  onChangeHeightCm: (cm: number) => void;
  onChangeWeightKg: (kg: number) => void;
  onChangeBodyFat: (bodyFat: number | null) => void;
}
export function BodyStatsStep(props: BodyStatsStepProps) {
  const { colors } = useTheme();
  const { units, weightKg, heightCm, dateOfBirth, onChangeHeightCm, onChangeWeightKg } = props;
  const metric = units === 'metric';
  const [localHeightUnits, setLocalHeightUnits] = useState<Units>('metric');
  const heightUnits = props.heightUnits ?? localHeightUnits;
  const heightMetric = heightUnits === 'metric';
  const weight = weightKg > 0 ? (metric ? weightKg : kgToLb(weightKg)) : metric ? 70 : 154;
  const height = heightCm > 0 ? heightCm : 175;
  const imperial = cmToFtIn(height);
  const age = dateOfBirth ? calculateAge(dateOfBirth) : 25;
  const unit = t(metric ? 'entryPolish.kg' : 'entryPolish.lb');
  return (
    <View style={planStyles.section} testID="body-stats-pickers">
      {!props.identityConfirmed ? (
        <PlanCard>
          <PlanTextField
            label={t('entryPolish.nickname')}
            value={props.nickname ?? ''}
            onChangeText={props.onChangeNickname ?? (() => {})}
            testID="input-nickname"
          />
          <CompactSelect
            label={t('onboarding.bodyStats.sexLabel')}
            selected={[props.sex]}
            onSelect={props.onChangeSex}
            options={(['male', 'female', 'other'] as const).map((value) => ({
              value,
              label: t(`onboarding.bodyStats.${value}`),
            }))}
            testID="sex-picker"
          />
        </PlanCard>
      ) : null}
      <PlanCard>
        <View style={styles.header}>
          <Text variant="heading">{t('onboarding.bodyStats.weightLabel')}</Text>
          <SegmentedControl
            options={[
              { value: 'imperial', label: t('entryPolish.lb') },
              { value: 'metric', label: t('entryPolish.kg') },
            ]}
            value={units}
            onChange={(value) => props.onChangeUnits(value as Units)}
            testID="weight-units"
          />
        </View>
        <Text
          variant="title1"
          tabular
          color={colors.textHi}
          style={styles.value}
          testID="weight-value"
        >
          {weightKg > 0 ? `${Math.round(weight * 10) / 10} ${unit}` : t('entryPolish.chooseValue')}
        </Text>
        <StatsPicker
          key={units}
          horizontal
          label={t('onboarding.bodyStats.weightLabel')}
          value={weight}
          min={metric ? 20 : 45}
          max={metric ? 500 : 1102}
          step={metric ? 0.5 : 1}
          format={(value) => `${value} ${unit}`}
          onChange={(value) => onChangeWeightKg(metric ? value : lbToKg(value))}
          testID="weight-ruler"
        />
        {props.errorWeight ? (
          <Text color={colors.danger} accessibilityRole="alert">
            {props.errorWeight}
          </Text>
        ) : null}
      </PlanCard>
      <PlanCard>
        <View style={styles.header}>
          <Text variant="heading">{t('onboarding.bodyStats.heightLabel')}</Text>
          <SegmentedControl
            options={[
              { value: 'imperial', label: t('entryPolish.ftIn') },
              { value: 'metric', label: t('repairUnits.cm') },
            ]}
            value={heightUnits}
            onChange={(value) => {
              setLocalHeightUnits(value as Units);
              props.onChangeHeightUnits?.(value as Units);
            }}
            testID="height-units"
          />
        </View>
        {heightCm <= 0 ? <Text variant="bodyS">{t('entryPolish.chooseValue')}</Text> : null}
        {heightMetric ? (
          <StatsPicker
            label={t('onboarding.bodyStats.heightLabel')}
            value={height}
            min={120}
            max={230}
            format={(value) => `${value} ${t('repairUnits.cm')}`}
            onChange={onChangeHeightCm}
            testID="height-cm-wheel"
          />
        ) : (
          <View style={styles.heightRow}>
            <View style={styles.flex}>
              <StatsPicker
                label={t('repairUnits.ft')}
                value={imperial.feet}
                min={4}
                max={7}
                format={(value) => `${value} ${t('repairUnits.ft')}`}
                onChange={(value) => onChangeHeightCm(ftInToCm(value, imperial.inches))}
                testID="height-ft-wheel"
              />
            </View>
            <View style={styles.flex}>
              <StatsPicker
                label={t('entryPolish.inch')}
                value={imperial.inches}
                min={0}
                max={11}
                format={(value) => `${value} ${t('entryPolish.inch')}`}
                onChange={(value) => onChangeHeightCm(ftInToCm(imperial.feet, value))}
                testID="height-in-wheel"
              />
            </View>
          </View>
        )}
        {props.errorHeight ? (
          <Text color={colors.danger} accessibilityRole="alert">
            {props.errorHeight}
          </Text>
        ) : null}
      </PlanCard>
      <PlanCard>
        <Text variant="heading">{t('entryPolish.age')}</Text>
        {props.identityConfirmed ? (
          <Text tabular>{t('entryPolish.years', { value: age })}</Text>
        ) : (
          <StatsPicker
            label={t('entryPolish.age')}
            value={age}
            min={16}
            max={90}
            format={(value) => t('entryPolish.years', { value })}
            testID="age-wheel"
            onChange={(value) => {
              // Local estimate for setup only. Account creation requires the actual birth date.
              const now = new Date();
              const year = now.getFullYear() - value;
              const month = now.getMonth();
              const day = Math.min(now.getDate(), new Date(year, month + 1, 0).getDate());
              props.onChangeDateOfBirth(
                `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
              );
            }}
          />
        )}
        <Text variant="bodyS">
          {t(props.identityConfirmed ? 'entryPolish.ageConfirmed' : 'entryPolish.ageHint')}
        </Text>
        {!dateOfBirth ? (
          <Text variant="bodyS">{t('entryPolish.chooseValue')}</Text>
        ) : age < 18 ? (
          <Text color={colors.danger} accessibilityRole="alert">
            {t('profileSetup.under18Error')}
          </Text>
        ) : null}
        {props.errorDateOfBirth ? (
          <Text color={colors.danger} accessibilityRole="alert">
            {props.errorDateOfBirth}
          </Text>
        ) : null}
      </PlanCard>
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    gap: space[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  value: { textAlign: 'center' },
  heightRow: { flexDirection: 'row', gap: space[2], flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 0 },
});
