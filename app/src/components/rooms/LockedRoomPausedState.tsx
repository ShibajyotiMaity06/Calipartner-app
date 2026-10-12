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

export interface LockedRoomPausedStateProps {
  onKeepRoomGoing: () => void;
}

/**
 * Screen shown to every member when a room's plan lapses.
 * Strictly non-shaming: never mentions who paid or whose card failed.
 * Assures members that all history is saved and personal tracking continues.
 */
export function LockedRoomPausedState({
  onKeepRoomGoing,
}: LockedRoomPausedStateProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      testID="screen-locked-room-paused"
    >
      <View
        style={[styles.iconCircle, { backgroundColor: colors.cardHighlight }]}
      >
        <Ionicons name="pause-circle-outline" size={42} color={colors.accent} />
      </View>

      <Text
        style={[styles.title, { color: colors.text }]}
        testID="text-locked-room-title"
      >
        {t('rooms.paused.title')}
      </Text>

      <Text
        style={[styles.subtitle, { color: colors.textMuted }]}
        testID="text-locked-room-subtitle"
      >
        {t('rooms.paused.subtitle')}
      </Text>

      {/* Safety & Preservation guarantees */}
      <View
        style={[styles.guaranteesBox, { backgroundColor: colors.surfaceAlt }]}
      >
        <View style={styles.guaranteeRow}>
          <Ionicons
            name="shield-checkmark-outline"
            size={16}
            color={colors.syncSynced}
          />
          <Text style={[styles.guaranteeText, { color: colors.text }]}>
            All room chat, photos and progress are safely saved
          </Text>
        </View>

        <View style={styles.guaranteeRow}>
          <Ionicons
            name="checkmark-circle-outline"
            size={16}
            color={colors.syncSynced}
          />
          <Text style={[styles.guaranteeText, { color: colors.text }]}>
            Personal logging (food, water, steps, workouts) is 100% free
          </Text>
        </View>

        <View style={styles.guaranteeRow}>
          <Ionicons
            name="people-outline"
            size={16}
            color={colors.syncSynced}
          />
          <Text style={[styles.guaranteeText, { color: colors.text }]}>
            Any member can keep this room going with a plan
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onKeepRoomGoing}
        style={[styles.keepGoingButton, { backgroundColor: colors.accent }]}
        accessibilityRole="button"
        accessibilityLabel={t('rooms.paused.keepGoingBtn')}
        testID="btn-keep-room-going"
      >
        <Ionicons name="sparkles" size={16} color="#FFFFFF" />
        <Text style={styles.keepGoingButtonText}>
          {t('rooms.paused.keepGoingBtn')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.md + 2,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.xs + 1,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
    maxWidth: 340,
  },
  guaranteesBox: {
    width: '100%',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guaranteeText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    flex: 1,
  },
  keepGoingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    gap: 8,
    width: '100%',
  },
  keepGoingButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
