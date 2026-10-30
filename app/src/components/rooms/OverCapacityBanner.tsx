import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@calipartner/ui';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { RoomSummary } from '@/types/rooms';

export interface OverCapacityBannerProps {
  room: RoomSummary;
  daysRemaining?: number;
  onUpgrade: () => void;
  onManageMembers?: () => void;
}

/**
 * Banner shown when a room exceeds its member capacity after a downgrade or refund.
 * Displays a 7-day countdown for the host to upgrade or remove members.
 */
export function OverCapacityBanner({
  room,
  daysRemaining = 7,
  onUpgrade,
  onManageMembers,
}: OverCapacityBannerProps) {
  const { colors } = useTheme();

  const isHost = room.role === 'host';
  const memberCap = room.member_cap ?? 5;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      testID="banner-over-capacity"
    >
      <View style={styles.topRow}>
        <View style={[styles.iconCircle, { backgroundColor: colors.cardHighlight }]}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.accent} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('rooms.overCapacity.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {isHost
              ? t('rooms.overCapacity.subtitleHost', {
                  count: room.member_count,
                  cap: memberCap,
                  days: daysRemaining,
                })
              : t('rooms.overCapacity.subtitleMember', {
                  count: room.member_count,
                  cap: memberCap,
                })}
          </Text>
        </View>
      </View>

      {/* Host actions */}
      {isHost && (
        <View style={styles.actionsRow}>
          <Pressable
            onPress={onUpgrade}
            style={[styles.upgradeBtn, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel={t('rooms.overCapacity.upgradeBtn')}
            testID="btn-over-capacity-upgrade"
          >
            <Ionicons name="information-circle-outline" size={14} color="#FFFFFF" />
            <Text style={styles.upgradeBtnText}>{t('rooms.overCapacity.upgradeBtn')}</Text>
          </Pressable>

          {onManageMembers && (
            <Pressable
              onPress={onManageMembers}
              style={[
                styles.manageBtn,
                { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('rooms.overCapacity.manageMembersBtn')}
              testID="btn-over-capacity-manage"
            >
              <Text style={[styles.manageBtnText, { color: colors.text }]}>
                {t('rooms.overCapacity.manageMembersBtn')}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
    gap: spacing.sm,
  },
  topRow: {
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
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    gap: 6,
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  manageBtn: {
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
