import React, { useState } from 'react';
import { StyleSheet, TextInput, View, TouchableOpacity } from 'react-native';
import { kgToLb, lbToKg, type CalculateTargetsResult, type Units } from '@calipartner/core';
import { Text, Button, space, dark, radius } from '@calipartner/ui';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';

interface TargetDateStepProps {
  units: Units;
  targetWeightKg: number | null;
  targetDate: string | null;
  calculatedTargets: CalculateTargetsResult | null;
  errorTargetWeight?: string;
  errorTargetDate?: string;
  onChangeTargetWeight: (weightKg: number | null) => void;
  onChangeTargetDate: (date: string | null) => void;
  onSkip: () => void;
}

export function TargetDateStep({
  units,
  targetWeightKg,
  targetDate,
  calculatedTargets,
  errorTargetWeight,
  errorTargetDate,
  onChangeTargetWeight,
  onChangeTargetDate,
  onSkip,
}: TargetDateStepProps) {
  const [weightText, setWeightText] = useState(
    targetWeightKg !== null
      ? units === 'metric'
        ? String(targetWeightKg)
        : String(Math.round(kgToLb(targetWeightKg) * 10) / 10)
      : '',
  );
  const [dateText, setDateText] = useState(targetDate ?? '');

  const handleWeightChange = (text: string) => {
    setWeightText(text);
    if (!text.trim()) {
      onChangeTargetWeight(null);
      return;
    }
    const parsed = parseFloat(text);
    if (!isNaN(parsed) && parsed > 0) {
      const kg = units === 'metric' ? parsed : lbToKg(parsed);
      onChangeTargetWeight(Math.round(kg * 10) / 10);
    }
  };

  const handleDateChange = (text: string) => {
    setDateText(text);
    onChangeTargetDate(text.trim() || null);
  };

  const analysis = calculatedTargets?.safety.targetDateAnalysis;

  return (
    <View style={styles.container}>
      {/* Target Weight Input */}
      <View style={styles.section}>
        <Text variant="label" color={dark.textLo} style={styles.sectionLabel}>
          {t('onboarding.targetDate.targetWeightLabel')} ({units === 'metric' ? 'kg' : 'lb'})
        </Text>
        <TextInput
          testID="input-target-weight"
          value={weightText}
          onChangeText={handleWeightChange}
          placeholder={units === 'metric' ? '65.0' : '143.0'}
          placeholderTextColor={dark.textOff}
          keyboardType="numeric"
          accessibilityLabel={t('onboarding.targetDate.targetWeightLabel')}
          style={[
            styles.input,
            {
              backgroundColor: dark.s2,
              borderColor: errorTargetWeight ? dark.danger : dark.hairline,
              color: dark.textHi,
            },
          ]}
        />
        {errorTargetWeight ? (
          <Text variant="label" color={dark.danger} testID="error-target-weight">
            {errorTargetWeight}
          </Text>
        ) : null}
      </View>

      {/* Target Date Input */}
      <View style={styles.section}>
        <Text variant="label" color={dark.textLo} style={styles.sectionLabel}>
          {t('onboarding.targetDate.targetDateLabel')}
        </Text>
        <TextInput
          testID="input-target-date"
          value={dateText}
          onChangeText={handleDateChange}
          placeholder={t('onboarding.targetDate.targetDatePlaceholder')}
          placeholderTextColor={dark.textOff}
          keyboardType="default"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={t('onboarding.targetDate.targetDateLabel')}
          style={[
            styles.input,
            {
              backgroundColor: dark.s2,
              borderColor: errorTargetDate ? dark.danger : dark.hairline,
              color: dark.textHi,
            },
          ]}
        />
        {errorTargetDate ? (
          <Text variant="label" color={dark.danger} testID="error-target-date">
            {errorTargetDate}
          </Text>
        ) : null}
      </View>

      {/* Target Date Analysis Feedback */}
      {analysis && (
        <View style={styles.analysisContainer}>
          {/* If required pace is safe and realistic */}
          {analysis.isRealistic && analysis.requiredRateKgPerWeek !== null && (
            <View style={styles.noticeCard} testID="target-required-rate-notice">
              <Text
                variant="body"
                color={dark.textHi}
                style={styles.noticeTitle}
                testID="target-required-rate-text"
              >
                {t('onboarding.targetDate.requiredRateText', {
                  rate: analysis.requiredRateKgPerWeek,
                })}
              </Text>
              <Text variant="label" color={dark.textMid} style={styles.noticeBody}>
                {t('onboarding.targetDate.sustainablePaceBody')}
              </Text>
            </View>
          )}

          {/* If pace exceeds weekly cap, show earliest realistic date (Spec ONB-5) */}
          {!analysis.isRealistic && analysis.earliestRealisticDate && (
            <View style={styles.noticeCard} testID="earliest-realistic-date-banner">
              <Text variant="body" color={dark.textHi} style={styles.noticeTitle}>
                {t('onboarding.targetDate.earliestDateNotice', {
                  date: analysis.earliestRealisticDate,
                })}
              </Text>
              <Text variant="label" color={dark.textMid} style={styles.noticeBody}>
                {t('onboarding.targetDate.sustainablePaceBody')}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Prominent Skip button for optional step (Spec A07) */}
      <View style={styles.skipContainer}>
        <Button
          variant="secondary"
          size="md"
          label={t('onboarding.skip')}
          onPress={() => {
            playClickSound();
            onSkip();
          }}
          testID="btn-skip-target-date"
        />
      </View>
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
  input: {
    minHeight: 48,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space[3],
    fontSize: 16,
  },
  analysisContainer: {
    gap: space[2],
  },
  noticeCard: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[1],
  },
  noticeTitle: {
    fontWeight: '600',
  },
  noticeBody: {
    lineHeight: 18,
  },
  skipContainer: {
    marginTop: space[2],
    alignItems: 'center',
  },
});
