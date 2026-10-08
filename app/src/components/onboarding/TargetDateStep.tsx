import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  kgToLb,
  lbToKg,
  type CalculateTargetsResult,
  type Units,
} from '@calipartner/core';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

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
  const { colors } = useTheme();

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
        <Text style={[styles.label, { color: colors.text }]}>
          {t('onboarding.targetDate.targetWeightLabel')} ({units === 'metric' ? 'kg' : 'lb'})
        </Text>
        <TextInput
          testID="input-target-weight"
          value={weightText}
          onChangeText={handleWeightChange}
          placeholder={units === 'metric' ? '65.0' : '143.0'}
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          accessibilityLabel={t('onboarding.targetDate.targetWeightLabel')}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: errorTargetWeight ? colors.danger : colors.border,
              color: colors.text,
            },
          ]}
        />
        {errorTargetWeight ? (
          <Text style={[styles.errorText, { color: colors.danger }]} testID="error-target-weight">
            {errorTargetWeight}
          </Text>
        ) : null}
      </View>

      {/* Target Date Input */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>
          {t('onboarding.targetDate.targetDateLabel')}
        </Text>
        <TextInput
          testID="input-target-date"
          value={dateText}
          onChangeText={handleDateChange}
          placeholder={t('onboarding.targetDate.targetDatePlaceholder')}
          placeholderTextColor={colors.textMuted}
          keyboardType="default"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={t('onboarding.targetDate.targetDateLabel')}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: errorTargetDate ? colors.danger : colors.border,
              color: colors.text,
            },
          ]}
        />
        {errorTargetDate ? (
          <Text style={[styles.errorText, { color: colors.danger }]} testID="error-target-date">
            {errorTargetDate}
          </Text>
        ) : null}
      </View>

      {/* Target Date Analysis Feedback */}
      {analysis && (
        <View style={styles.analysisContainer}>
          {/* If required pace is safe and realistic */}
          {analysis.isRealistic && analysis.requiredRateKgPerWeek !== null && (
            <View
              style={[
                styles.noticeCard,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
              testID="target-required-rate-notice"
            >
              <Text
                style={[styles.noticeTitle, { color: colors.text }]}
                testID="target-required-rate-text"
              >
                {t('onboarding.targetDate.requiredRateText', {
                  rate: analysis.requiredRateKgPerWeek,
                })}
              </Text>
              <Text style={[styles.noticeBody, { color: colors.textMuted }]}>
                {t('onboarding.targetDate.sustainablePaceBody')}
              </Text>
            </View>
          )}

          {/* If pace exceeds weekly cap, show earliest realistic date */}
          {!analysis.isRealistic && analysis.earliestRealisticDate && (
            <View
              style={[
                styles.noticeCard,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
              testID="earliest-realistic-date-banner"
            >
              <Text style={[styles.noticeTitle, { color: colors.text }]}>
                {t('onboarding.targetDate.earliestDateNotice', {
                  date: analysis.earliestRealisticDate,
                })}
              </Text>
              <Text style={[styles.noticeBody, { color: colors.textMuted }]}>
                {t('onboarding.targetDate.sustainablePaceBody')}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Skip button for optional step */}
      <View style={styles.skipContainer}>
        <Pressable
          testID="btn-skip-target-date"
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.skip')}
          onPress={() => {
            playClickSound();
            onSkip();
          }}
          style={({ pressed }) => [
            styles.skipButton,
            {
              borderColor: colors.border,
              backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
            },
          ]}
        >
          <Text style={[styles.skipButtonText, { color: colors.textMuted }]}>
            {t('onboarding.skip')}
          </Text>
        </Pressable>
      </View>
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
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
  },
  errorText: {
    fontSize: fontSize.sm - 1,
    fontWeight: '500',
  },
  analysisContainer: {
    gap: spacing.sm,
  },
  noticeCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  noticeTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    lineHeight: 20,
  },
  noticeBody: {
    fontSize: fontSize.sm - 1,
    lineHeight: 18,
  },
  skipContainer: {
    paddingTop: spacing.xs,
    alignItems: 'center',
  },
  skipButton: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
});
