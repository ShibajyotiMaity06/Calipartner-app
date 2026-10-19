import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { kgToLb, type CalculateTargetsResult, type Goal, type Units } from '@calipartner/core';
import { Text, CheckIcon, Chip, space, dark, radius } from '@calipartner/ui';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';

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
  if (!calculatedTargets) {
    return (
      <View style={styles.emptyContainer} testID="rate-picker-empty">
        <Text variant="body" color={dark.textLo}>
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
      {/* Maintenance Baseline Callout with Numeral-XL (Spec A09) */}
      <View style={styles.maintenanceCard} testID="maintenance-callout-card">
        <Text variant="label" color={dark.textLo} style={styles.maintenanceHeader}>
          {t('onboarding.rate.maintenanceHeader')}
        </Text>
        <View style={styles.numeralRow}>
          <Text
            variant="numeralXL"
            color={dark.textHi}
            style={styles.numeralXL}
            testID="maintenance-callout-text"
          >
            {tdee.toLocaleString()}
          </Text>
          <Text variant="body" color={dark.textMid} style={styles.numeralUnit}>
            kcal a day to stay the same
          </Text>
        </View>
        <Text variant="bodyS" color={dark.textMid} style={styles.maintenanceCopy}>
          Faster is not always better. 0.5 kg a week is easy to keep up.
        </Text>
      </View>

      {/* Maintain-Only Notice */}
      {goal === 'maintain' ? (
        <View style={styles.maintainNoticeCard} testID="maintain-notice-card">
          <Text variant="heading" color={dark.textHi} style={styles.maintainNoticeTitle}>
            {t('onboarding.rate.targetKcalText', { kcal: tdee })}
          </Text>
          <Text variant="body" color={dark.textMid}>
            {t('onboarding.rate.maintainOnlyNotice')}
          </Text>
        </View>
      ) : (
        /* Preset Rates List (0.25, 0.5, 0.75, 1 kg/week) */
        <View style={styles.ratesList} accessible accessibilityRole="radiogroup">
          {presetRates.map((preset) => {
            const isSelected = selectedRateKg === preset.rateKgPerWeek && preset.available;
            const isUnavailable = !preset.available;
            const isRecommended = preset.rateKgPerWeek === 0.5;

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
              <TouchableOpacity
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
                activeOpacity={0.8}
                style={[
                  styles.rateCard,
                  {
                    backgroundColor: isUnavailable ? dark.s1 : isSelected ? dark.s2 : dark.s1,
                    borderColor: isUnavailable
                      ? dark.hairline
                      : isSelected
                        ? dark.apricot
                        : dark.hairline,
                    borderWidth: isSelected ? 2 : 1,
                    opacity: isUnavailable ? 0.45 : 1,
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
                            ? dark.hairline
                            : isSelected
                              ? dark.apricot
                              : dark.hairlineLit,
                          backgroundColor: isSelected ? dark.apricot : 'transparent',
                        },
                      ]}
                    >
                      {isSelected && <CheckIcon size={12} color={dark.onBrand} />}
                    </View>
                    <Text
                      variant="body"
                      color={isUnavailable ? dark.textLo : dark.textHi}
                      style={styles.rateTitle}
                    >
                      {rateFormatted}
                    </Text>
                  </View>

                  <View style={styles.badgeRow}>
                    {/* Spec A09: Recommended (0.5) marked "Steady" */}
                    {isRecommended && !isUnavailable && (
                      <View style={styles.steadyBadge}>
                        <Text variant="label" color={dark.onBrand} style={styles.steadyBadgeText}>
                          Steady
                        </Text>
                      </View>
                    )}

                    {isUnavailable ? (
                      <View
                        style={styles.unavailableBadge}
                        testID={`rate-disabled-badge-${preset.rateKgPerWeek}`}
                      >
                        <Text variant="label" color={dark.textLo}>
                          {t('onboarding.rate.unavailableBadge')}
                        </Text>
                      </View>
                    ) : (
                      <Text variant="bodyS" color={dark.textMid}>
                        {diffText}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Daily Calorie Target numeral */}
                <View style={styles.rateBottomRow}>
                  <Text
                    variant="numeralXL"
                    color={isUnavailable ? dark.textLo : dark.textHi}
                    style={styles.targetKcalNumber}
                  >
                    {preset.targetKcal.toLocaleString()}
                  </Text>
                  <Text variant="bodyS" color={dark.textLo} style={styles.targetKcalUnit}>
                    kcal / day
                  </Text>
                </View>

                {/* Disabled Reason / Nearest allowed explanation */}
                {isUnavailable && preset.reason && (
                  <View
                    style={styles.reasonCard}
                    testID={`rate-reason-container-${preset.rateKgPerWeek}`}
                  >
                    <Text variant="label" color={dark.danger} style={styles.reasonText}>
                      {renderDisabledReason(preset.reason)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {errorMessage ? (
        <Text variant="label" color={dark.danger} style={styles.errorText}>
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space[4],
    gap: space[3],
    paddingTop: space[2],
  },
  emptyContainer: {
    padding: space[4],
    alignItems: 'center',
  },
  maintenanceCard: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
    padding: space[4],
    gap: space[2],
  },
  maintenanceHeader: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  numeralRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
  },
  numeralXL: {
    lineHeight: 38,
  },
  numeralUnit: {
    flexShrink: 1,
  },
  maintenanceCopy: {
    lineHeight: 20,
    marginTop: 2,
  },
  maintainNoticeCard: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[2],
  },
  maintainNoticeTitle: {
    fontWeight: '700',
  },
  ratesList: {
    gap: space[3],
  },
  rateCard: {
    borderRadius: radius.card,
    padding: space[4],
    gap: space[2],
    minHeight: 88,
  },
  rateTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rateTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateTitle: {
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  steadyBadge: {
    backgroundColor: dark.apricot,
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.control,
  },
  steadyBadgeText: {
    fontWeight: '700',
    fontSize: 11,
  },
  unavailableBadge: {
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.control,
  },
  rateBottomRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
    paddingLeft: 34,
  },
  targetKcalNumber: {
    lineHeight: 32,
    fontWeight: '700',
  },
  targetKcalUnit: {
    fontWeight: '500',
  },
  reasonCard: {
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    padding: space[2],
    marginTop: space[1],
    marginLeft: 34,
  },
  reasonText: {
    fontWeight: '500',
  },
  errorText: {
    marginTop: space[1],
  },
});
