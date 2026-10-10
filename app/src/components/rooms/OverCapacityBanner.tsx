import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { RoomSummary } from '@/types/rooms';

interface OverCapacityBannerProps {
  room: RoomSummary;
  onUpgrade: () => void;
}

export function OverCapacityBanner({ room, onUpgrade }: OverCapacityBannerProps) {
  const { colors } = useTheme();

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
          <Ionicons name="people" size={18} color={colors.accent} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('rooms.overCapacity.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('rooms.overCapacity.subtitleHost', {
              count: room.member_count,
              cap: room.member_cap ?? 5,
            })}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onUpgrade}
        style={[styles.upgradeBtn, { backgroundColor: colors.accent }]}
        accessibilityRole="button"
        accessibilityLabel={t('rooms.overCapacity.upgradeBtn')}
        testID="btn-over-capacity-upgrade"
      >
        <Ionicons name="sparkles" size={14} color="#FFFFFF" />
        <Text style={styles.upgradeBtnText}>
          {t('rooms.overCapacity.upgradeBtn')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
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
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.pill,
    gap: 6,
    alignSelf: 'stretch',
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs + 1,
    fontWeight: '700',
  },
});
