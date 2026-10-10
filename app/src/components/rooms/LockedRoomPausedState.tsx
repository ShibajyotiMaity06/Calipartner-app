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

interface LockedRoomPausedStateProps {
  onKeepRoomGoing: () => void;
}

export function LockedRoomPausedState({ onKeepRoomGoing }: LockedRoomPausedStateProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}
      testID="screen-locked-room-paused"
    >
      <View style={[styles.iconCircle, { backgroundColor: colors.cardHighlight }]}>
        <Ionicons name="pause-circle-outline" size={40} color={colors.accent} />
      </View>

      <Text style={[styles.title, { color: colors.text }]} testID="text-locked-room-title">
        {t('rooms.paused.title')}
      </Text>

      <Text style={[styles.subtitle, { color: colors.textMuted }]} testID="text-locked-room-subtitle">
        {t('rooms.paused.subtitle')}
      </Text>

      <Pressable
        onPress={onKeepRoomGoing}
        style={[styles.keepGoingButton, { backgroundColor: colors.accent }]}
        accessibilityRole="button"
        accessibilityLabel={t('rooms.paused.keepGoingBtn')}
        testID="btn-keep-room-going"
      >
        <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />
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
    textAlign: 'center',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.md + 2,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.xs + 1,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
    maxWidth: 320,
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
