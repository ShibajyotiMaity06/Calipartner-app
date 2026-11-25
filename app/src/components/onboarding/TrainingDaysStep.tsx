import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Card,
  Text,
  borders,
  colors,
  fonts,
  radius,
  space,
  triggerHaptic,
} from '@calipartner/ui/v1';
import { t } from '@/i18n';

const DAY_COUNTS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

interface TrainingDaysStepProps {
  gymDays: number;
  trainingDays: readonly number[];
  onSelectCount: (count: number) => void;
  onToggleWeekday: (dayIndex: number) => void;
}

export function TrainingDaysStep({
  gymDays,
  trainingDays,
  onSelectCount,
  onToggleWeekday,
}: TrainingDaysStepProps) {
  return (
    <View style={styles.root} testID="gym-days">
      <View style={styles.heroWrap}>
        <Text maxFontSizeMultiplier={1.2} tabular style={styles.heroNumber} testID="gym-days-count">
          {String(gymDays)}
        </Text>
        <Text variant="meta" color="textLo" style={styles.heroCaption}>
          {gymDays === 1 ? t('onboardingV1.dayPerWeek') : t('onboardingV1.daysPerWeek')}
        </Text>
      </View>

      <View style={styles.countRow} accessibilityRole="radiogroup">
        {DAY_COUNTS.map((count) => {
          const selected = gymDays === count;
          return (
            <Pressable
              key={count}
              onPress={() => {
                triggerHaptic('selection');
                onSelectCount(count);
              }}
              hitSlop={4}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${count} ${count === 1 ? t('onboardingV1.dayPerWeek') : t('onboardingV1.daysPerWeek')}`}
              testID={`gym-day-count-${count}`}
              style={[
                styles.countPill,
                selected ? styles.countPillSelected : styles.countPillDefault,
              ]}
            >
              <Text
                maxFontSizeMultiplier={1.2}
                tabular
                style={[
                  styles.countLabel,
                  {
                    fontFamily: selected ? fonts.bold : fonts.semibold,
                    color: selected ? colors.onBrand : colors.textMid,
                  },
                ]}
              >
                {String(count)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card variant="default" style={styles.rhythmCard} testID="training-rhythm-card">
        <Text variant="meta" color="textLo" style={styles.rhythmLabel}>
          {t('onboardingV1.rhythmTitle')}
        </Text>
        <View style={styles.weekdaysRow}>
          {WEEKDAY_LETTERS.map((letter, idx) => {
            const active = trainingDays.includes(idx);
            return (
              <Pressable
                key={idx}
                onPress={() => {
                  triggerHaptic('selection');
                  onToggleWeekday(idx);
                }}
                hitSlop={4}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                testID={`training-weekday-${idx}`}
                style={[styles.dayCircle, active ? styles.dayCircleActive : styles.dayCircleRest]}
              >
                <Text
                  maxFontSizeMultiplier={1.2}
                  style={[
                    styles.dayText,
                    {
                      fontFamily: active ? fonts.bold : fonts.semibold,
                      color: active ? colors.onBrand : colors.textOff,
                    },
                  ]}
                >
                  {letter}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
  },
  heroWrap: {
    alignItems: 'center',
    marginBottom: space.xl,
  },
  heroNumber: {
    fontFamily: fonts.display,
    fontSize: 80,
    lineHeight: 84,
    letterSpacing: -2.4,
    color: colors.textHi,
  },
  heroCaption: {
    marginTop: space.xs,
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.xl,
  },
  countPill: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillDefault: {
    backgroundColor: colors.bg0,
    borderWidth: borders.width,
    borderColor: colors.hairline,
  },
  countPillSelected: {
    backgroundColor: colors.apricot,
  },
  countLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  rhythmCard: {
    padding: space.lg,
  },
  rhythmLabel: {
    marginBottom: space.md,
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: {
    backgroundColor: colors.apricot,
  },
  dayCircleRest: {
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
  },
  dayText: {
    fontSize: 13,
    lineHeight: 16,
  },
});
