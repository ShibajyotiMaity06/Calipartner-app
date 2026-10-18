import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export function CoachDailyLimitBanner() {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
        },
      ]}
      testID="banner-coach-daily-limit"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="time-outline" size={20} color={colors.accent} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: colors.text }]}>{t('coach.dailyLimit.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {t('coach.dailyLimit.subtitle')}
        </Text>
      </View>
    </View>
  );
}

export function CoachOfflineBanner() {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
        },
      ]}
      testID="banner-coach-offline"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="cloud-offline-outline" size={20} color={colors.textMuted} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: colors.text }]}>{t('coach.offline.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {t('coach.offline.subtitle')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  iconWrap: {
    padding: 4,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 16,
  },
});
