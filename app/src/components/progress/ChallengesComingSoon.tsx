import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface ChallengesComingSoonProps {
  testID?: string;
}

export function ChallengesComingSoon({
  testID = 'challenges-coming-soon',
}: ChallengesComingSoonProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: colors.surface }]}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={`${t('progress.challenges.comingSoon')}. ${t('progress.challenges.comingSoonSubtitle')}`}
    >
      <View style={[styles.iconContainer, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name="ribbon-outline" size={44} color={colors.accent} />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        {t('progress.challenges.comingSoon')}
      </Text>

      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        {t('progress.challenges.comingSoonSubtitle')}
      </Text>

      <View
        style={[styles.badge, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
      >
        <Ionicons name="information-circle-outline" size={14} color={colors.accent} />
        <Text style={[styles.badgeText, { color: colors.textMuted }]}>Phase 8 Feature</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: spacing.md,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
    marginBottom: spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
});
