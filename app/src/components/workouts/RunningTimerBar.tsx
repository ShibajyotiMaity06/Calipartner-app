import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWorkoutTimer } from '@/hooks/useWorkouts';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface RunningTimerBarProps {
  workoutId?: string | null;
  onApplyDuration?: (durationMinutes: number) => void;
  style?: object;
  testID?: string;
}

export function RunningTimerBar({
  workoutId,
  onApplyDuration,
  style,
  testID = 'running-timer-bar',
}: RunningTimerBarProps) {
  const { colors } = useTheme();
  const { timer, formattedTime, isRunning, start, pause, resume, stop } =
    useWorkoutTimer(workoutId);

  const hasTimer = Boolean(timer);

  const handleToggle = async () => {
    if (!hasTimer) {
      await start();
    } else if (isRunning) {
      await pause();
    } else {
      await resume();
    }
  };

  const handleStop = async () => {
    const elapsedSeconds = await stop();
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    if (onApplyDuration) {
      onApplyDuration(durationMinutes);
    }
  };

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: isRunning ? colors.accent : colors.border,
        },
        style,
      ]}
      accessibilityRole="toolbar"
      accessibilityLabel={t('workouts.timer.title')}
    >
      <View style={styles.infoRow}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isRunning ? colors.syncSynced : colors.syncPending },
          ]}
        />
        <View style={styles.textWrap}>
          <Text style={[styles.timerLabel, { color: colors.textMuted }]}>
            {isRunning
              ? t('workouts.timer.running')
              : hasTimer
                ? t('workouts.timer.paused')
                : t('workouts.timer.title')}
          </Text>
          <Text
            testID={`${testID}-time`}
            style={[styles.timerValue, { color: colors.text }]}
            accessibilityLabel={`${formattedTime}`}
          >
            {formattedTime}
          </Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          testID={`${testID}-btn-toggle`}
          style={[
            styles.iconButton,
            { backgroundColor: isRunning ? colors.surfaceAlt : colors.accent },
          ]}
          onPress={handleToggle}
          accessibilityRole="button"
          accessibilityLabel={
            !hasTimer
              ? t('workouts.timer.start')
              : isRunning
                ? t('workouts.timer.pause')
                : t('workouts.timer.resume')
          }
        >
          <Ionicons
            name={isRunning ? 'pause' : 'play'}
            size={18}
            color={isRunning ? colors.text : colors.onAccent}
          />
        </TouchableOpacity>

        {hasTimer && (
          <TouchableOpacity
            testID={`${testID}-btn-stop`}
            style={[styles.stopButton, { backgroundColor: colors.surfaceAlt }]}
            onPress={handleStop}
            accessibilityRole="button"
            accessibilityLabel={t('workouts.timer.stop')}
          >
            <Ionicons name="stop" size={16} color={colors.danger} />
            <Text style={[styles.stopText, { color: colors.danger }]}>
              {t('workouts.timer.stop')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  textWrap: {
    justifyContent: 'center',
  },
  timerLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timerValue: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  stopText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
