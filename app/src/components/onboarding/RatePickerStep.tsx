import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  kgToLb,
  type CalculateTargetsResult,
  type Goal,
  type Units,
} from '@calipartner/core';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface RatePickerStepProps {
  goal: Goal;
  units: Units;
  selectedRateKg: number;
  calculatedTargets: CalculateTargetsResult | null;
  errorMessage?: string;
  onSelectRate: (rateKg: number) => void;
}

export function RatePickerStep({
  goal,
  units,
  selectedRateKg,
  calculatedTargets,
  errorMessage,
  onSelectRate,
}: RatePickerStepProps) {
  const { colors } = useTheme();

  if (!calculatedTargets) {
    return (
      <View style={styles.emptyContainer} testID="rate-picker-empty">
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {t('onboarding.summary.emptyBody')}
        </Text>
      </View>
    );
  }

  const { tdee, presetRates, safety } = calculatedTargets;

  const renderDisabledReason = (reason?: string | null) => {
    switch (reason) {
      case 'below_calorie_floor':
        return t('onboarding.rate.reasonFloor', {
          floor: safety.calorieFloor,
        });
      case 'above_rate_cap':
        return t('onboarding.rate.reasonCap', {
          cap: safety.rateCapKgPerWeek,
        });
      case 'bmi_too_low':
        return t('onboarding.rate.reasonBmi');
      default:
        return reason ?? '';
    }
  };

  return (
    <View style={styles.container}>
      {/* Maintenance Baseline Callout */}
      <View
        style={[
          styles.maintenanceCard,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        ]}
        testID="maintenance-callout-card"
      >
        <Text style={[styles.maintenanceHeader, { color: colors.textMuted }]}>
          {t('onboarding.rate.maintenanceHeader')}
        </Text>
        <Text
          style={[styles.maintenanceKcal, { color: colors.text }]}
          testID="maintenance-callout-text"
        >
          {t('onboarding.rate.maintenanceKcal', { kcal: tdee })}
        </Text>
        <Text style={[styles.maintenanceDesc, { color: colors.textMuted }]}>
          {t('onboarding.rate.maintenanceDesc')}
        </Text>
      </View>

      {/* Maintain-Only Notice */}
      {goal === 'maintain' ? (
        <View
          style={[
            styles.maintainNoticeCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          testID="maintain-notice-card"
        >
          <Text style={[styles.maintainNoticeTitle, { color: colors.text }]}>
            {t('onboarding.rate.targetKcalText', { kcal: tdee })}
          </Text>
          <Text style={[styles.maintainNoticeText, { color: colors.textMuted }]}>
            {t('onboarding.rate.maintainOnlyNotice')}
          </Text>
        </View>
      ) : (
        /* Preset Rates List */
        <View style={styles.ratesList} accessible accessibilityRole="radiogroup">
          {presetRates.map((preset) => {
            const isSelected = selectedRateKg === preset.rateKgPerWeek && preset.available;
            const isUnavailable = !preset.available;
            const rateFormatted =
              units === 'metric'
                ? t('onboarding.rate.rateCardTitle', { rate: preset.rateKgPerWeek })
                : t('onboarding.rate.rateCardTitleImperial', {
                    rate: Math.round(kgToLb(preset.rateKgPerWeek) * 100) / 100,
                  });

            const diffText =
              preset.dailyChangeKcal < 0
                ? t('onboarding.rate.deficitText', {
                    diff: Math.abs(preset.dailyChangeKcal),
                  })
                : t('onboarding.rate.surplusText', {
                    diff: preset.dailyChangeKcal,
                  });

            return (
              <Pressable
                key={preset.rateKgPerWeek}
                testID={`rate-card-${preset.rateKgPerWeek}`}
                accessibilityRole="radio"
                accessibilityState={{
                  selected: isSelected,
                  disabled: isUnavailable,
                }}
                accessibilityLabel={`${rateFormatted}, ${preset.targetKcal} calories per day. ${
                  isUnavailable ? renderDisabledReason(preset.reason) : ''
                }`}
                disabled={isUnavailable}
                onPress={() => {
                  playClickSound();
                  onSelectRate(preset.rateKgPerWeek);
                }}
                style={({ pressed }) => [
                  styles.rateCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isUnavailable
                      ? colors.border
                      : isSelected
                        ? colors.accent
                        : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                    opacity: isUnavailable ? 0.55 : pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View style={styles.rateTopRow}>
                  <View style={styles.rateTitleGroup}>
                    <View
                      style={[
                        styles.radioCircle,
                        {
                          borderColor: isUnavailable
                            ? colors.border
                            : isSelected
                              ? colors.accent
                              : colors.border,
                          backgroundColor: isSelected ? colors.accent : 'transparent',
                        },
                      ]}
                    >
                      {isSelected && (
                        <View style={[styles.radioDot, { backgroundColor: colors.onAccent }]} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.rateTitle,
                        { color: isUnavailable ? colors.textMuted : colors.text },
                      ]}
                    >
                      {rateFormatted}
                    </Text>
                  </View>

                  {isUnavailable ? (
                    <View
                      style={[
                        styles.unavailableBadge,
                        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                      ]}
                      testID={`rate-disabled-badge-${preset.rateKgPerWeek}`}
                    >
                      <Text style={[styles.unavailableBadgeText, { color: colors.textMuted }]}>
                        {t('onboarding.rate.unavailableBadge')}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.diffText, { color: colors.textMuted }]}>{diffText}</Text>
                  )}
                </View>

                {/* Daily Calorie Target numeral */}
                <View style={styles.rateBottomRow}>
                  <Text
                    style={[
                      styles.targetKcal,
                      { color: isUnavailable ? colors.textMuted : colors.text },
                    ]}
                  >
                    {t('onboarding.rate.targetKcalText', { kcal: preset.targetKcal })}
                  </Text>
                </View>

                {/* Disabled reason banner */}
                {isUnavailable && preset.reason && (
                  <View
                    style={[
                      styles.disabledReasonContainer,
                      { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                    ]}
                    testID={`rate-disabled-reason-${preset.rateKgPerWeek}`}
                  >
                    <Text style={[styles.disabledReasonText, { color: colors.textMuted }]}>
                      {renderDisabledReason(preset.reason)}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Advisories */}
      {safety.advisories.includes('large_deficit_advisory') && (
        <View
          style={[
            styles.advisoryCard,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
          testID="rate-advisory-large-deficit"
        >
          <Text style={[styles.advisoryText, { color: colors.text }]}>
            {t('onboarding.rate.advisoryLargeDeficit')}
          </Text>
        </View>
      )}

      {safety.advisories.includes('lean_gain_advisory') && (
        <View
          style={[
            styles.advisoryCard,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
          testID="rate-advisory-lean-gain"
        >
          <Text style={[styles.advisoryText, { color: colors.text }]}>
            {t('onboarding.rate.advisoryLeanGain')}
          </Text>
        </View>
      )}

      {/* Validation error */}
      {errorMessage ? (
        <Text
          style={[styles.errorText, { color: colors.danger }]}
          testID="error-rate-selection"
        >
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: fontSize.md,
    textAlign: 'center',
  },
  maintenanceCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  maintenanceHeader: {
    fontSize: fontSize.sm - 1,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  maintenanceKcal: {
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  maintenanceDesc: {
    fontSize: fontSize.sm - 1,
    lineHeight: 18,
  },
  maintainNoticeCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  maintainNoticeTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  maintainNoticeText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  ratesList: {
    gap: spacing.sm,
  },
  rateCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  rateTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rateTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  rateTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  diffText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  unavailableBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  unavailableBadgeText: {
    fontSize: fontSize.sm - 2,
    fontWeight: '600',
  },
  rateBottomRow: {
    paddingLeft: 28,
  },
  targetKcal: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  disabledReasonContainer: {
    marginTop: spacing.xs,
    marginLeft: 28,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  disabledReasonText: {
    fontSize: fontSize.sm - 1,
    lineHeight: 17,
  },
  advisoryCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  advisoryText: {
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  errorText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
});
