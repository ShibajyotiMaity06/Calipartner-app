import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface TrialBannerProps {
  daysLeft?: number;
  dayNumber?: number;
  onViewPlans: () => void;
  isHost?: boolean;
}

export function TrialBanner({
  daysLeft = 2,
  dayNumber = 1,
  onViewPlans,
  isHost = true,
}: TrialBannerProps) {
  const { colors } = useTheme();

  // Only hosts get the trial room banner
  if (!isHost) {
    return null;
  }

  const titleText =
    dayNumber === 3 || daysLeft <= 0
      ? t('rooms.trialBanner.day3')
      : dayNumber === 2 || daysLeft === 1
        ? t('rooms.trialBanner.day2')
        : t('rooms.trialBanner.day1');

  return (
    <View
      style={[
        styles.bannerContainer,
        {
          backgroundColor: colors.cardHighlight,
          borderColor: colors.accent,
        },
      ]}
      testID="banner-trial-days"
    >
      <View style={styles.contentRow}>
        <View style={[styles.iconCircle, { backgroundColor: colors.surface }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text }]}>{titleText}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('rooms.trialBanner.explanation')}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onViewPlans}
        style={[styles.actionButton, { backgroundColor: colors.accent }]}
        accessibilityRole="button"
        accessibilityLabel={t('rooms.trialBanner.viewPlansBtn')}
        testID="btn-trial-view-plans"
      >
        <Ionicons name="card-outline" size={14} color={colors.onAccent} />
        <Text style={[styles.actionButtonText, { color: colors.onAccent }]}>
          {t('rooms.trialBanner.viewPlansBtn')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
    gap: spacing.sm,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  actionButtonText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
