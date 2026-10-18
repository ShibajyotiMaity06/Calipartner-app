import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface LockedFeatureCardProps {
  onUnlock: () => void;
}

/**
 * Locked preview card for the AI Coach (PRD 6.22, 7.10, SUB-16).
 * Calm, transparent tone. Explains that AI Coach is personal and included with any Room Plan.
 */
export function AiCoachLockedCard({ onUnlock }: LockedFeatureCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      testID="card-ai-coach-locked"
    >
      <View style={styles.topRow}>
        <View style={[styles.iconCircle, { backgroundColor: colors.cardHighlight }]}>
          <Ionicons name="sparkles" size={22} color={colors.macroCalories} />
        </View>

        <View style={styles.titleGroup}>
          <View style={styles.badgeRow}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('rooms.lockedPreview.aiCoach.title')}
            </Text>
            <View style={[styles.badge, { backgroundColor: colors.cardHighlight }]}>
              <Text style={[styles.badgeText, { color: colors.accent }]}>
                {t('rooms.lockedPreview.aiCoach.badge')}
              </Text>
            </View>
          </View>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('rooms.lockedPreview.aiCoach.subtitle')}
          </Text>
        </View>
      </View>

      {/* Feature Bullet Points */}
      <View style={[styles.bulletsBox, { backgroundColor: colors.surfaceAlt }]}>
        <View style={styles.bulletItem}>
          <Ionicons name="checkmark-circle" size={16} color={colors.syncSynced} />
          <Text style={[styles.bulletText, { color: colors.text }]}>
            {t('rooms.lockedPreview.aiCoach.feature1')}
          </Text>
        </View>

        <View style={styles.bulletItem}>
          <Ionicons name="checkmark-circle" size={16} color={colors.syncSynced} />
          <Text style={[styles.bulletText, { color: colors.text }]}>
            {t('rooms.lockedPreview.aiCoach.feature2')}
          </Text>
        </View>

        <View style={styles.bulletItem}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.bulletText, { color: colors.textMuted }]}>
            {t('rooms.lockedPreview.aiCoach.feature3')}
          </Text>
        </View>
      </View>

      {/* Unlock CTA */}
      <Pressable
        onPress={onUnlock}
        style={[styles.unlockButton, { backgroundColor: colors.accent }]}
        accessibilityRole="button"
        accessibilityLabel={t('rooms.lockedPreview.aiCoach.unlockBtn')}
        testID="btn-unlock-ai-coach"
      >
        <Ionicons name="sparkles" size={14} color="#FFFFFF" />
        <Text style={styles.unlockButtonText}>{t('rooms.lockedPreview.aiCoach.unlockBtn')}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Locked preview card for the Partner Finder (PRD 6.24, 7.12, SUB-16).
 * Calm, transparent tone. Explains that opting-in is free, while browsing matches requires a Room Plan.
 */
export function PartnerFinderLockedCard({ onUnlock }: LockedFeatureCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      testID="card-partner-finder-locked"
    >
      <View style={styles.topRow}>
        <View style={[styles.iconCircle, { backgroundColor: colors.cardHighlight }]}>
          <Ionicons name="compass" size={22} color={colors.accent} />
        </View>

        <View style={styles.titleGroup}>
          <View style={styles.badgeRow}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('rooms.lockedPreview.partnerFinder.title')}
            </Text>
            <View style={[styles.badge, { backgroundColor: colors.cardHighlight }]}>
              <Text style={[styles.badgeText, { color: colors.accent }]}>
                {t('rooms.lockedPreview.partnerFinder.badge')}
              </Text>
            </View>
          </View>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('rooms.lockedPreview.partnerFinder.subtitle')}
          </Text>
        </View>
      </View>

      {/* Feature Bullet Points */}
      <View style={[styles.bulletsBox, { backgroundColor: colors.surfaceAlt }]}>
        <View style={styles.bulletItem}>
          <Ionicons name="checkmark-circle" size={16} color={colors.syncSynced} />
          <Text style={[styles.bulletText, { color: colors.text }]}>
            {t('rooms.lockedPreview.partnerFinder.feature1')}
          </Text>
        </View>

        <View style={styles.bulletItem}>
          <Ionicons name="checkmark-circle" size={16} color={colors.syncSynced} />
          <Text style={[styles.bulletText, { color: colors.text }]}>
            {t('rooms.lockedPreview.partnerFinder.feature2')}
          </Text>
        </View>

        <View style={styles.bulletItem}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.bulletText, { color: colors.textMuted }]}>
            {t('rooms.lockedPreview.partnerFinder.feature3')}
          </Text>
        </View>
      </View>

      {/* Unlock CTA */}
      <Pressable
        onPress={onUnlock}
        style={[styles.unlockButton, { backgroundColor: colors.accent }]}
        accessibilityRole="button"
        accessibilityLabel={t('rooms.lockedPreview.partnerFinder.unlockBtn')}
        testID="btn-unlock-partner-finder"
      >
        <Ionicons name="sparkles" size={14} color="#FFFFFF" />
        <Text style={styles.unlockButtonText}>
          {t('rooms.lockedPreview.partnerFinder.unlockBtn')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleGroup: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: fontSize.sm + 1,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 17,
  },
  bulletsBox: {
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 8,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletText: {
    fontSize: fontSize.xs,
    lineHeight: 16,
    flex: 1,
    fontWeight: '500',
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.pill,
    gap: 6,
    marginTop: 2,
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs + 1,
    fontWeight: '700',
  },
});
