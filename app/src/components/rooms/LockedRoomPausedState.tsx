import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { dark, radius, space, Text as UiText, Button } from '@calipartner/ui';
import { fontSize } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface LockedRoomPausedStateProps {
  onKeepRoomGoing: () => void;
  onLeaveRoom?: () => void;
}

/**
 * J20 · Room paused (Locked) (ROOM-7, SUB-8)
 * Layout: Paired card desaturated to textLo with dashed seam, centred card:
 * "This room is paused." · "Your streak is saved for 30 days." ·
 * Primary "Keep this room going" (opens paywall) · secondary "Leave room" (confirm).
 * Strictly non-shaming: nobody is told who stopped paying or why.
 */
export function LockedRoomPausedState({
  onKeepRoomGoing,
  onLeaveRoom,
}: LockedRoomPausedStateProps): React.JSX.Element {
  const { colors } = useTheme();

  const handleLeaveConfirm = () => {
    const webConfirm =
      typeof globalThis !== 'undefined'
        ? (globalThis as unknown as { confirm?: (msg: string) => boolean }).confirm
        : undefined;
    if (typeof webConfirm === 'function') {
      const confirmed = webConfirm(
        'Are you sure you want to leave this room? Personal diaries and logged entries remain yours.',
      );
      if (confirmed && onLeaveRoom) {
        onLeaveRoom();
      }
      return;
    }

    Alert.alert(
      'Leave room',
      'Are you sure you want to leave this room? Personal diaries and logged entries remain yours.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave room',
          style: 'destructive',
          onPress: onLeaveRoom,
        },
      ],
    );
  };

  return (
    <View style={styles.container} testID="screen-locked-room-paused">
      {/* 1. Desaturated preview paired card with dashed seam (Spec J20) */}
      <View style={styles.desaturatedPreviewCard}>
        <View style={styles.previewColumnsRow}>
          <View style={styles.previewColumn}>
            <View style={styles.previewAvatar} />
            <UiText variant="label" color={dark.textLo}>
              You
            </UiText>
            <UiText variant="micro" color={dark.textLo}>
              — %
            </UiText>
          </View>

          {/* Fully dashed seam */}
          <View style={styles.dashedSeamLine} />

          <View style={styles.previewColumn}>
            <View style={styles.previewAvatar} />
            <UiText variant="label" color={dark.textLo}>
              Partner
            </UiText>
            <UiText variant="micro" color={dark.textLo}>
              — %
            </UiText>
          </View>
        </View>
      </View>

      {/* 2. Centered Paused State Card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.iconCircle}>
          <Ionicons name="pause-circle-outline" size={40} color={dark.apricot} />
        </View>

        <Text style={[styles.title, { color: colors.text }]} testID="text-locked-room-title">
          {t('rooms.paused.title')}
        </Text>

        <Text style={[styles.streakSavedNotice, { color: colors.text }]}>
          Your streak is saved for 30 days.
        </Text>

        <Text style={[styles.subtitle, { color: colors.textMuted }]} testID="text-locked-room-subtitle">
          {t('rooms.paused.subtitle')}
        </Text>

        {/* Guarantees Box */}
        <View style={[styles.guaranteesBox, { backgroundColor: colors.surfaceAlt }]}>
          <View style={styles.guaranteeRow}>
            <Ionicons name="shield-checkmark-outline" size={16} color={dark.teal} />
            <Text style={[styles.guaranteeText, { color: colors.text }]}>
              All room chat, photos, and streak records are safely preserved
            </Text>
          </View>

          <View style={styles.guaranteeRow}>
            <Ionicons name="checkmark-circle-outline" size={16} color={dark.teal} />
            <Text style={[styles.guaranteeText, { color: colors.text }]}>
              Personal logging (meals, water, steps, workouts) is 100% free
            </Text>
          </View>

          <View style={styles.guaranteeRow}>
            <Ionicons name="people-outline" size={16} color={dark.teal} />
            <Text style={[styles.guaranteeText, { color: colors.text }]}>
              Any member can keep this room going with a room plan
            </Text>
          </View>
        </View>

        {/* Actions: Primary "Keep this room going", Secondary "Leave room" */}
        <View style={styles.actionsWrap}>
          <Button
            variant="primary"
            size="md"
            label="Keep this room going"
            onPress={onKeepRoomGoing}
            testID="btn-keep-room-going"
          />

          {onLeaveRoom && (
            <Button
              variant="secondary"
              size="md"
              label="Leave room"
              onPress={handleLeaveConfirm}
              testID="btn-leave-paused-room"
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: space[3],
    gap: space[3],
  },
  desaturatedPreviewCard: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
    padding: space[4],
    opacity: 0.5,
  },
  previewColumnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 90,
  },
  previewColumn: {
    flex: 1,
    alignItems: 'center',
    gap: space[1],
  },
  previewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
  dashedSeamLine: {
    width: 1,
    height: 80,
    borderLeftWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: dark.hairlineLit,
  },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space[4],
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2],
  },
  title: {
    fontSize: fontSize.md + 2,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: space[1],
  },
  streakSavedNotice: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: space[2],
  },
  subtitle: {
    fontSize: fontSize.xs + 1,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: space[4],
    maxWidth: 340,
  },
  guaranteesBox: {
    width: '100%',
    borderRadius: radius.control,
    padding: space[3],
    marginBottom: space[4],
    gap: space[2],
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  guaranteeText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    flex: 1,
  },
  actionsWrap: {
    width: '100%',
    gap: space[2],
  },
});
