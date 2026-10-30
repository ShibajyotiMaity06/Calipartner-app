import React, { useMemo } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Text, type as typography } from '@calipartner/ui';
import { Ionicons } from '@expo/vector-icons';
import { calculateCardioPaceAndSpeed } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface CardioFormProps {
  durationMinutes: number;
  distanceKm: number;
  onDurationChange: (minutes: number) => void;
  onDistanceChange: (km: number) => void;
  testID?: string;
}

export function CardioForm({
  durationMinutes,
  distanceKm,
  onDurationChange,
  onDistanceChange,
  testID = 'cardio-form',
}: CardioFormProps) {
  const { colors } = useTheme();

  const metrics = useMemo(() => {
    return calculateCardioPaceAndSpeed(durationMinutes, distanceKm);
  }, [durationMinutes, distanceKm]);

  const handleStepDuration = (delta: number) => {
    const next = Math.max(0, durationMinutes + delta);
    onDurationChange(next);
  };

  const handleStepDistance = (delta: number) => {
    const next = Math.max(0, Math.round((distanceKm + delta) * 10) / 10);
    onDistanceChange(next);
  };

  return (
    <View
      testID={testID}
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="none"
      accessibilityLabel={t('workouts.cardio.title')}
    >
      <View style={styles.headerRow}>
        <Ionicons name="speedometer-outline" size={20} color={colors.accent} />
        <Text style={[styles.title, { color: colors.text }]}>{t('workouts.cardio.title')}</Text>
      </View>

      {/* Duration Stepper Row */}
      <View style={styles.fieldSection}>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {t('workouts.cardio.duration')}
        </Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            testID={`${testID}-btn-duration-minus`}
            style={[styles.stepBtn, { backgroundColor: colors.surfaceAlt }]}
            onPress={() => handleStepDuration(-5)}
            accessibilityRole="button"
            accessibilityLabel="-5 minutes"
          >
            <Text style={[styles.stepBtnText, { color: colors.text }]}>-5</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID={`${testID}-btn-duration-minus-1`}
            style={[styles.stepBtn, { backgroundColor: colors.surfaceAlt }]}
            onPress={() => handleStepDuration(-1)}
            accessibilityRole="button"
            accessibilityLabel="-1 minute"
          >
            <Ionicons name="remove" size={18} color={colors.text} />
          </TouchableOpacity>

          <TextInput
            testID={`${testID}-input-duration`}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
            keyboardType="number-pad"
            value={durationMinutes > 0 ? String(durationMinutes) : ''}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            onChangeText={(txt) => {
              const num = parseInt(txt.replace(/[^0-9]/g, ''), 10);
              onDurationChange(isNaN(num) ? 0 : num);
            }}
            accessibilityLabel={t('workouts.cardio.duration')}
          />

          <TouchableOpacity
            testID={`${testID}-btn-duration-plus-1`}
            style={[styles.stepBtn, { backgroundColor: colors.surfaceAlt }]}
            onPress={() => handleStepDuration(1)}
            accessibilityRole="button"
            accessibilityLabel="+1 minute"
          >
            <Ionicons name="add" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            testID={`${testID}-btn-duration-plus`}
            style={[styles.stepBtn, { backgroundColor: colors.surfaceAlt }]}
            onPress={() => handleStepDuration(5)}
            accessibilityRole="button"
            accessibilityLabel="+5 minutes"
          >
            <Text style={[styles.stepBtnText, { color: colors.text }]}>+5</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Distance Stepper Row */}
      <View style={styles.fieldSection}>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {t('workouts.cardio.distance')}
        </Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            testID={`${testID}-btn-distance-minus-1`}
            style={[styles.stepBtn, { backgroundColor: colors.surfaceAlt }]}
            onPress={() => handleStepDistance(-1)}
            accessibilityRole="button"
            accessibilityLabel="-1 km"
          >
            <Text style={[styles.stepBtnText, { color: colors.text }]}>-1</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID={`${testID}-btn-distance-minus`}
            style={[styles.stepBtn, { backgroundColor: colors.surfaceAlt }]}
            onPress={() => handleStepDistance(-0.5)}
            accessibilityRole="button"
            accessibilityLabel="-0.5 km"
          >
            <Ionicons name="remove" size={18} color={colors.text} />
          </TouchableOpacity>

          <TextInput
            testID={`${testID}-input-distance`}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
            keyboardType="decimal-pad"
            value={distanceKm > 0 ? String(distanceKm) : ''}
            placeholder="0.0"
            placeholderTextColor={colors.textMuted}
            onChangeText={(txt) => {
              const num = parseFloat(txt.replace(/[^0-9.]/g, ''));
              onDistanceChange(isNaN(num) ? 0 : num);
            }}
            accessibilityLabel={t('workouts.cardio.distance')}
          />

          <TouchableOpacity
            testID={`${testID}-btn-distance-plus`}
            style={[styles.stepBtn, { backgroundColor: colors.surfaceAlt }]}
            onPress={() => handleStepDistance(0.5)}
            accessibilityRole="button"
            accessibilityLabel="+0.5 km"
          >
            <Ionicons name="add" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            testID={`${testID}-btn-distance-plus-1`}
            style={[styles.stepBtn, { backgroundColor: colors.surfaceAlt }]}
            onPress={() => handleStepDistance(1)}
            accessibilityRole="button"
            accessibilityLabel="+1 km"
          >
            <Text style={[styles.stepBtnText, { color: colors.text }]}>+1</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Calculated Pace and Speed Metrics Banner */}
      <View
        style={[
          styles.metricsCard,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        ]}
      >
        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
            {t('workouts.cardio.calculatedPace')}
          </Text>
          <Text
            testID={`${testID}-text-pace`}
            style={[styles.metricValue, { color: colors.accent }]}
          >
            {metrics.formatted_pace}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
            {t('workouts.cardio.calculatedSpeed')}
          </Text>
          <Text
            testID={`${testID}-text-speed`}
            style={[styles.metricValue, { color: colors.text }]}
          >
            {metrics.speed_km_h > 0 ? `${metrics.speed_km_h} km/h` : '0 km/h'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  fieldSection: {
    gap: 6,
  },
  label: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    textAlign: 'center',
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.md,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metricsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginBottom: 2,
  },
  metricValue: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.md,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    width: 1,
    height: 28,
  },
});
