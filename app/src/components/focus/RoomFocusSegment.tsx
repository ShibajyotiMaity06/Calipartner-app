import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoomFocus } from '@/hooks/useRoomFocus';
import { useRoomWeeklyFocusStats } from '@/hooks/useFocusStats';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { FocusRunningModal } from './FocusRunningModal';
import { FocusStartModal } from './FocusStartModal';
import { formatMinutesDisplay, formatTimeDigits } from './focusUIUtils';

export interface RoomFocusSegmentProps {
  roomId: string;
  roomName?: string;
  userId?: string | null;
  isVisible: boolean;
  isLocked?: boolean;
  testID?: string;
}

export function RoomFocusSegment({
  roomId,
  roomName,
  userId,
  isVisible,
  isLocked = false,
  testID = 'room-focus-segment',
}: RoomFocusSegmentProps) {
  const { colors } = useTheme();

  const {
    activeSession,
    participants,
    recentSessions,
    isStarter,
    isParticipating,
    myParticipant,
    remainingSeconds,
    myElapsedSeconds,
    loading,
    error,
    start,
    join,
    leave,
    pause,
    resume,
    end,
    refresh,
  } = useRoomFocus(roomId, { userId, isVisible });

  const { stats: weeklyStats, loading: statsLoading } = useRoomWeeklyFocusStats(roomId);

  const [startModalVisible, setStartModalVisible] = useState(false);
  const [runningModalVisible, setRunningModalVisible] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const isTimer = activeSession?.mode === 'timer';
  const displayedTimerSeconds = isTimer ? (remainingSeconds ?? 0) : myElapsedSeconds;

  const isMyParticipantPaused = myParticipant?.status === 'break';

  const handleJoin = async () => {
    try {
      setActionBusy(true);
      await join();
    } finally {
      setActionBusy(false);
    }
  };

  const handleLeave = async () => {
    try {
      setActionBusy(true);
      await leave();
    } finally {
      setActionBusy(false);
    }
  };

  const handlePauseToggle = async () => {
    try {
      setActionBusy(true);
      if (isMyParticipantPaused) {
        await resume();
      } else {
        await pause();
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleEndSession = async () => {
    try {
      setActionBusy(true);
      await end();
    } finally {
      setActionBusy(false);
    }
  };

  if (loading && !activeSession) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      testID={testID}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {/* Locked Room State Warning */}
      {isLocked && (
        <View
          testID="banner-room-focus-locked"
          style={[
            styles.lockedBanner,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
        >
          <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.lockedTitle, { color: colors.text }]}>Room Sessions Paused</Text>
            <Text style={[styles.lockedDesc, { color: colors.textMuted }]}>
              {t('focus.roomLockedNotice')}
            </Text>
          </View>
        </View>
      )}

      {/* Error Banner */}
      {Boolean(error) && (
        <View
          testID="banner-room-focus-error"
          style={[
            styles.errorBanner,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
        >
          <Ionicons name="alert-circle-outline" size={18} color={colors.accent} />
          <Text style={[styles.errorText, { color: colors.text }]}>
            {error?.message || t('common.errorBody')}
          </Text>
        </View>
      )}

      {/* 1. ACTIVE SESSION CARD (IF ANY) */}
      {activeSession ? (
        <View
          testID="card-active-room-focus"
          style={[
            styles.activeCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.activeHeaderRow}>
            <View style={styles.badgeRow}>
              <View style={[styles.modeBadge, { backgroundColor: colors.cardHighlight }]}>
                <Ionicons
                  name={isTimer ? 'hourglass-outline' : 'timer-outline'}
                  size={14}
                  color={colors.accent}
                />
                <Text style={[styles.modeBadgeText, { color: colors.accent }]}>
                  {isTimer ? t('focus.timer') : t('focus.stopwatch')}
                </Text>
              </View>

              {activeSession.label ? (
                <View style={[styles.labelBadge, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.labelBadgeText, { color: colors.text }]}>
                    {activeSession.label}
                  </Text>
                </View>
              ) : (
                <View style={[styles.labelBadge, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="lock-closed" size={10} color={colors.textMuted} />
                  <Text style={[styles.labelBadgeText, { color: colors.textMuted }]}>
                    Private Label
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={() => setRunningModalVisible(true)}
              style={styles.expandBtn}
              accessibilityRole="button"
              accessibilityLabel="Open full focus screen"
            >
              <Ionicons name="expand-outline" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Time Display */}
          <View style={styles.timeRow}>
            <Text style={[styles.timeDigits, { color: colors.text }]}>
              {formatTimeDigits(displayedTimerSeconds)}
            </Text>
            <Text style={[styles.timeLabel, { color: colors.textMuted }]}>
              {isTimer ? 'Remaining for everyone' : 'Your time in session'}
            </Text>
          </View>

          {/* Participants Roster */}
          <View style={styles.participantsBox}>
            <Text style={[styles.participantsHeader, { color: colors.textMuted }]}>
              {t('focus.participantsTitle')} ({participants.length})
            </Text>

            <View style={styles.participantsList}>
              {participants.map((p) => {
                const onBreak = p.status === 'break';
                const isMe = p.user_id === userId;
                return (
                  <View key={p.user_id} style={styles.participantRow}>
                    <View style={styles.participantLeft}>
                      <View style={[styles.avatarDot, { backgroundColor: colors.surfaceAlt }]}>
                        <Ionicons name="person" size={12} color={colors.text} />
                      </View>
                      <Text
                        style={[
                          styles.participantName,
                          {
                            color: colors.text,
                            fontWeight: isMe ? '700' : '500',
                          },
                        ]}
                      >
                        {isMe ? 'You' : p.user_id.slice(0, 8)}
                      </Text>
                    </View>

                    <View style={styles.participantRight}>
                      <Text
                        style={[
                          styles.participantStatusText,
                          { color: onBreak ? colors.textMuted : colors.accent },
                        ]}
                      >
                        {onBreak ? 'Break' : 'Focusing'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Action Buttons Row */}
          <View style={styles.actionsRow}>
            {!isParticipating ? (
              <Pressable
                testID="btn-room-focus-join"
                onPress={handleJoin}
                disabled={actionBusy || isLocked}
                style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityLabel={t('focus.joinBtn')}
              >
                <Ionicons name="enter-outline" size={16} color={colors.onAccent} />
                <Text style={[styles.btnText, { color: colors.onAccent }]}>
                  {t('focus.joinBtn')}
                </Text>
              </Pressable>
            ) : (
              <>
                {/* Break / Resume */}
                <Pressable
                  testID={isMyParticipantPaused ? 'btn-room-focus-resume' : 'btn-room-focus-pause'}
                  onPress={handlePauseToggle}
                  disabled={actionBusy}
                  style={[
                    styles.secondaryBtn,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isMyParticipantPaused ? t('focus.resumeBtn') : t('focus.pauseBtn')
                  }
                >
                  <Ionicons
                    name={isMyParticipantPaused ? 'play' : 'pause'}
                    size={16}
                    color={colors.text}
                  />
                  <Text style={[styles.btnText, { color: colors.text }]}>
                    {isMyParticipantPaused ? t('focus.resumeBtn') : t('focus.pauseBtn')}
                  </Text>
                </Pressable>

                {/* Leave */}
                <Pressable
                  testID="btn-room-focus-leave"
                  onPress={handleLeave}
                  disabled={actionBusy}
                  style={[
                    styles.secondaryBtn,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('focus.leaveBtn')}
                >
                  <Ionicons name="exit-outline" size={16} color={colors.text} />
                  <Text style={[styles.btnText, { color: colors.text }]}>
                    {t('focus.leaveBtn')}
                  </Text>
                </Pressable>

                {/* End (if starter or host) */}
                {isStarter && (
                  <Pressable
                    testID="btn-room-focus-end"
                    onPress={handleEndSession}
                    disabled={actionBusy}
                    style={[
                      styles.secondaryBtn,
                      {
                        backgroundColor: colors.surfaceAlt,
                        borderColor: colors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t('focus.endRoomSessionBtn')}
                  >
                    <Ionicons name="stop-circle-outline" size={16} color={colors.accent} />
                    <Text style={[styles.btnText, { color: colors.accent }]}>End</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      ) : (
        /* 2. NO ACTIVE SESSION: START TRIGGER */
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.cardHighlight }]}>
            <Ionicons name="timer-outline" size={36} color={colors.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('focus.roomFocusTitle')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            {t('focus.roomFocusSubtitle')}
          </Text>

          <Pressable
            testID="btn-start-room-focus"
            onPress={() => setStartModalVisible(true)}
            disabled={isLocked}
            style={[
              styles.startRoomBtn,
              {
                backgroundColor: isLocked ? colors.surfaceAlt : colors.accent,
                opacity: isLocked ? 0.6 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Start a focus session for the room"
          >
            <Ionicons name="play" size={16} color={colors.onAccent} />
            <Text style={[styles.startRoomBtnText, { color: colors.onAccent }]}>
              Start a focus session for the room
            </Text>
          </Pressable>
        </View>
      )}

      {/* 3. ROOM WEEKLY TOTALS SECTION (RPG-8, FOC-10 - NEUTRAL, NO RANKING) */}
      <View
        testID="list-room-focus-weekly-totals"
        style={[styles.totalsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={styles.totalsHeaderRow}>
          <Text style={[styles.totalsTitle, { color: colors.text }]}>
            {t('focus.roomWeeklyTotalsTitle')}
          </Text>
          {weeklyStats?.room_total_minutes !== undefined && (
            <Text
              style={[
                styles.roomTotalBadge,
                { color: colors.accent, backgroundColor: colors.cardHighlight },
              ]}
            >
              {formatMinutesDisplay(weeklyStats.room_total_minutes)} total
            </Text>
          )}
        </View>

        <Text style={[styles.neutralNote, { color: colors.textMuted }]}>
          {t('focus.neutralSortingNote')}
        </Text>

        {statsLoading && !weeklyStats ? (
          <ActivityIndicator
            size="small"
            color={colors.accent}
            style={{ marginVertical: spacing.md }}
          />
        ) : (
          <View style={styles.membersTable}>
            {weeklyStats?.members?.map((m) => {
              return (
                <View key={m.user_id} style={styles.memberTableRow}>
                  <View style={styles.memberNameGroup}>
                    <View style={[styles.avatarDot, { backgroundColor: colors.surfaceAlt }]}>
                      <Ionicons name="person" size={12} color={colors.text} />
                    </View>
                    <Text style={[styles.memberNameText, { color: colors.text }]}>
                      {m.is_me ? `${m.nickname} (You)` : m.nickname}
                    </Text>
                  </View>

                  <View style={styles.memberMinutesGroup}>
                    {m.is_hidden ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
                        <Text style={[styles.memberMinutesText, { color: colors.textMuted }]}>
                          Hidden
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={[
                          styles.memberMinutesText,
                          { color: colors.text, fontWeight: '700' },
                        ]}
                      >
                        {formatMinutesDisplay(m.weekly_focus_minutes ?? 0)}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* 4. RECENT SESSIONS SECTION */}
      <View
        testID="list-room-focus-recent"
        style={[styles.recentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text style={[styles.recentHeader, { color: colors.text }]}>
          {t('focus.recentSessionsTitle')}
        </Text>

        {recentSessions.length === 0 ? (
          <Text style={[styles.noRecentText, { color: colors.textMuted }]}>
            {t('focus.noRecentSessions')}
          </Text>
        ) : (
          <View style={styles.recentList}>
            {recentSessions.slice(0, 10).map((s) => {
              const dateStr = s.started_at ? s.started_at.slice(0, 10) : '';
              const durationMins = s.duration_minutes || 25;
              return (
                <View key={s.id} style={styles.recentRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.recentRowTitle, { color: colors.text }]}>
                      {s.label || (s.mode === 'timer' ? 'Focus Timer' : 'Stopwatch')}
                    </Text>
                    <Text style={[styles.recentRowSub, { color: colors.textMuted }]}>
                      {dateStr} • {s.mode}
                    </Text>
                  </View>
                  <Text style={[styles.recentDurationText, { color: colors.textMuted }]}>
                    {formatMinutesDisplay(durationMins)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Start Modal */}
      {startModalVisible && (
        <FocusStartModal
          visible={startModalVisible}
          onClose={() => setStartModalVisible(false)}
          roomId={roomId}
          roomName={roomName}
          isRoomLocked={isLocked}
          onStartPersonal={async () => {
            // Handled separately
          }}
          onStartRoom={async (mode, label, plannedSeconds) => {
            await start(mode, label, plannedSeconds);
            await refresh();
          }}
        />
      )}

      {/* Full Running Screen Modal */}
      {runningModalVisible && (
        <FocusRunningModal
          visible={runningModalVisible}
          onClose={() => setRunningModalVisible(false)}
          roomSession={activeSession}
          roomRemainingSeconds={remainingSeconds}
          roomMyElapsedSeconds={myElapsedSeconds}
          roomParticipants={participants}
          isRoomStarter={isStarter}
          onPauseRoom={pause}
          onResumeRoom={resume}
          onLeaveRoom={leave}
          onEndRoom={end}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 40,
  },
  loadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: fontSize.xs,
  },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  lockedTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  lockedDesc: {
    fontSize: fontSize.xs,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.xs,
  },
  errorText: {
    fontSize: fontSize.xs,
    flex: 1,
  },
  activeCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
  },
  activeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  labelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  labelBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  expandBtn: {
    padding: 4,
  },
  timeRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  timeDigits: {
    fontSize: 48,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  timeLabel: {
    fontSize: fontSize.xs,
    marginTop: 4,
  },
  participantsBox: {
    gap: spacing.xs,
  },
  participantsHeader: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  participantsList: {
    gap: 4,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  participantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarDot: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantName: {
    fontSize: fontSize.xs,
  },
  participantRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    gap: 6,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
  },
  btnText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  emptyCard: {
    padding: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    maxWidth: 280,
  },
  startRoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  startRoomBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  totalsCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  totalsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalsTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  roomTotalBadge: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  neutralNote: {
    fontSize: 11,
  },
  membersTable: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  memberTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  memberNameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberNameText: {
    fontSize: fontSize.xs,
  },
  memberMinutesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberMinutesText: {
    fontSize: fontSize.xs,
  },
  recentCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  recentHeader: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  noRecentText: {
    fontSize: fontSize.xs,
  },
  recentList: {
    gap: spacing.xs,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  recentRowTitle: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  recentRowSub: {
    fontSize: 11,
  },
  recentDurationText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
