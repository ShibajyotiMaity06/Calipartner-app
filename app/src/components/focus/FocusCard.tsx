import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { usePersonalFocus } from '@/hooks/usePersonalFocus';
import { usePersonalFocusStats } from '@/hooks/useFocusStats';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { FocusRunningModal } from './FocusRunningModal';
import { FocusStartModal } from './FocusStartModal';
import { formatMinutesDisplay, formatTimeDigits } from './focusUIUtils';

export interface FocusCardProps {
  selectedDate?: string;
  testID?: string;
}

export function FocusCard({
  selectedDate,
  testID = 'focus-card',
}: FocusCardProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const {
    session,
    elapsedSeconds,
    remainingSeconds,
    isActive,
    isPaused,
    start,
    pause,
    resume,
    end,
  } = usePersonalFocus({ userId });

  const { stats, loading: statsLoading } = usePersonalFocusStats(
    selectedDate,
    selectedDate,
    userId,
  );

  const [startModalVisible, setStartModalVisible] = useState(false);
  const [runningModalVisible, setRunningModalVisible] = useState(false);

  const hasActiveSession = Boolean(session && (isActive || isPaused));
  const isTimer = session?.mode === 'timer';
  const displayedSeconds = isTimer
    ? (remainingSeconds ?? 0)
    : elapsedSeconds;

  const todayMinutes = stats?.daily_breakdown?.[0]?.focus_minutes ?? 0;
  const weeklyGoalMinutes = stats?.weekly_goal_minutes ?? 0;
  const weeklyTotalMinutes = stats?.total_focus_minutes ?? 0;

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: colors.surfaceAlt },
            ]}
          >
            <Ionicons name="timer" size={18} color={colors.accent} />
          </View>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('focus.cardTitle')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {t('focus.cardSubtitle')}
            </Text>
          </View>
        </View>

        {/* Today Focus Minutes Badge */}
        <View
          style={[
            styles.todayBadge,
            { backgroundColor: colors.surfaceAlt },
          ]}
        >
          {statsLoading ? (
            <ActivityIndicator size="small" color={colors.accent} testID="focus-card-loading" />
          ) : (
            <>
              <Ionicons name="flame-outline" size={14} color={colors.accent} />
              <Text
                testID="text-today-focus-time"
                style={[styles.todayBadgeText, { color: colors.text }]}
              >
                {formatMinutesDisplay(todayMinutes)}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Active Session Strip (If Running or Paused) */}
      {hasActiveSession ? (
        <View
          style={[
            styles.activeSessionBox,
            {
              backgroundColor: isPaused
                ? colors.surfaceAlt
                : colors.cardHighlight,
              borderColor: isPaused ? colors.border : colors.accent,
            },
          ]}
        >
          <View style={styles.activeLeft}>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: isPaused
                      ? colors.textMuted
                      : colors.accent,
                  },
                ]}
              />
              <Text
                style={[
                  styles.statusLabel,
                  { color: isPaused ? colors.textMuted : colors.accent },
                ]}
              >
                {isPaused ? t('focus.pausedStatus') : t('focus.activeStatus')}
              </Text>
              {session?.label && (
                <Text
                  style={[styles.sessionLabelText, { color: colors.text }]}
                >
                  • {session.label}
                </Text>
              )}
            </View>

            <Text
              style={[
                styles.activeTimerDigits,
                { color: colors.text },
              ]}
            >
              {formatTimeDigits(displayedSeconds)}
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: '500',
                  color: colors.textMuted,
                }}
              >
                {isTimer ? ' left' : ''}
              </Text>
            </Text>
          </View>

          <View style={styles.activeActions}>
            {/* Quick Pause / Resume */}
            <Pressable
              testID="btn-focus-card-pause-toggle"
              onPress={isPaused ? resume : pause}
              hitSlop={6}
              style={[
                styles.iconActionBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                isPaused ? t('focus.resumeBtn') : t('focus.pauseBtn')
              }
            >
              <Ionicons
                name={isPaused ? 'play' : 'pause'}
                size={16}
                color={colors.text}
              />
            </Pressable>

            {/* View / Open Running Screen */}
            <Pressable
              testID="btn-focus-card-view"
              onPress={() => setRunningModalVisible(true)}
              style={[
                styles.viewActionBtn,
                { backgroundColor: colors.accent },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('focus.viewBtn')}
            >
              <Text
                style={[styles.viewActionText, { color: colors.onAccent }]}
              >
                {t('focus.viewBtn')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        /* Empty / Idle State: Start Session Prompt */
        <View style={styles.idleRow}>
          <View style={{ flex: 1, gap: 2 }}>
            {weeklyGoalMinutes > 0 ? (
              <Text style={[styles.goalText, { color: colors.textMuted }]}>
                {t('focus.goalProgress', {
                  completed: weeklyTotalMinutes,
                  goal: weeklyGoalMinutes,
                })}
              </Text>
            ) : (
              <Text style={[styles.goalText, { color: colors.textMuted }]}>
                Ready for deep work?
              </Text>
            )}
          </View>

          <Pressable
            testID="btn-focus-card-start"
            onPress={() => setStartModalVisible(true)}
            style={[
              styles.startBtn,
              { backgroundColor: colors.accent },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('focus.startBtn')}
          >
            <Ionicons name="play" size={14} color={colors.onAccent} />
            <Text
              style={[styles.startBtnText, { color: colors.onAccent }]}
            >
              {t('focus.startBtn')}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Start Modal */}
      {startModalVisible && (
        <FocusStartModal
          visible={startModalVisible}
          onClose={() => setStartModalVisible(false)}
          onStartPersonal={async (mode, label, plannedSeconds) => {
            await start(mode, label, plannedSeconds);
            setRunningModalVisible(true);
          }}
        />
      )}

      {/* Running Screen Modal */}
      {runningModalVisible && (
        <FocusRunningModal
          visible={runningModalVisible}
          onClose={() => setRunningModalVisible(false)}
          personalSession={session}
          personalElapsedSeconds={elapsedSeconds}
          personalRemainingSeconds={remainingSeconds}
          onPausePersonal={pause}
          onResumePersonal={resume}
          onEndPersonal={end}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: fontSize.xs,
  },
  todayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  todayBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  activeSessionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: 4,
  },
  activeLeft: {
    gap: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  sessionLabelText: {
    fontSize: 11,
    fontWeight: '600',
  },
  activeTimerDigits: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  activeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  viewActionText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  idleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  goalText: {
    fontSize: fontSize.xs,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  startBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
