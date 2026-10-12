import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  FocusSession,
  RoomFocusParticipant,
  RoomFocusSession,
} from '@calipartner/core';
import { shouldAutoStopStopwatch, shouldPromptStillFocusing, shouldSuggestBreak } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { formatTimeAccessible, formatTimeDigits } from './focusUIUtils';

export interface FocusRunningModalProps {
  visible: boolean;
  onClose: () => void;
  // Personal session state
  personalSession?: FocusSession | null;
  personalElapsedSeconds?: number;
  personalRemainingSeconds?: number | null;
  onPausePersonal?: () => Promise<void>;
  onResumePersonal?: () => Promise<void>;
  onEndPersonal?: () => Promise<void>;

  // Room session state (if room session)
  roomSession?: RoomFocusSession | null;
  roomRemainingSeconds?: number | null;
  roomMyElapsedSeconds?: number;
  roomParticipants?: RoomFocusParticipant[];
  isRoomStarter?: boolean;
  onPauseRoom?: () => Promise<void>;
  onResumeRoom?: () => Promise<void>;
  onLeaveRoom?: () => Promise<void>;
  onEndRoom?: () => Promise<void>;

  testID?: string;
}

export function FocusRunningModal({
  visible,
  onClose,
  personalSession,
  personalElapsedSeconds = 0,
  personalRemainingSeconds = null,
  onPausePersonal,
  onResumePersonal,
  onEndPersonal,
  roomSession,
  roomRemainingSeconds = null,
  roomMyElapsedSeconds = 0,
  roomParticipants = [],
  isRoomStarter = false,
  onPauseRoom,
  onResumeRoom,
  onLeaveRoom,
  onEndRoom,
  testID = 'focus-running-modal',
}: FocusRunningModalProps) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);

  const isRoom = Boolean(roomSession);
  const mode = isRoom ? roomSession?.mode : personalSession?.mode;
  const isTimer = mode === 'timer';

  const label = isRoom ? roomSession?.label : personalSession?.label;
  const status = isRoom
    ? (roomParticipants.find((p) => p.status === 'break') ? 'paused' : 'active')
    : personalSession?.status;
  const isPaused = status === 'paused';

  // Timer values
  const displayedSeconds = isTimer
    ? isRoom
      ? (roomRemainingSeconds ?? 0)
      : (personalRemainingSeconds ?? 0)
    : isRoom
      ? roomMyElapsedSeconds
      : personalElapsedSeconds;

  const accessibleTimeText = formatTimeAccessible(displayedSeconds, isTimer);

  // Health & Safety Prompts (PRD FOC-12)
  const sessionStartedAt = personalSession?.started_at || roomSession?.started_at;
  const showBreakPrompt = sessionStartedAt
    ? shouldSuggestBreak(sessionStartedAt)
    : displayedSeconds >= 5400;
  const showStillFocusing =
    !isTimer && (sessionStartedAt ? shouldPromptStillFocusing(sessionStartedAt) : displayedSeconds >= 14400);
  const showAutoStopNotice =
    !isTimer && (sessionStartedAt ? shouldAutoStopStopwatch(sessionStartedAt) : displayedSeconds >= 43200);

  const handlePauseToggle = async () => {
    try {
      setBusy(true);
      if (isRoom) {
        if (isPaused && onResumeRoom) {
          await onResumeRoom();
        } else if (onPauseRoom) {
          await onPauseRoom();
        }
      } else {
        if (isPaused && onResumePersonal) {
          await onResumePersonal();
        } else if (onPausePersonal) {
          await onPausePersonal();
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const executeEndSession = async () => {
    try {
      setBusy(true);
      if (isRoom) {
        if (isRoomStarter && onEndRoom) {
          await onEndRoom();
        } else if (onLeaveRoom) {
          await onLeaveRoom();
        }
      } else if (onEndPersonal) {
        await onEndPersonal();
      }
      setShowConfirmEnd(false);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleEndPress = () => {
    if (Platform.OS === 'web') {
      const g = globalThis as unknown as { confirm?: (msg: string) => boolean };
      const confirmed =
        typeof g.confirm === 'function'
          ? g.confirm(t('focus.confirmEndMessage'))
          : true;
      if (confirmed) {
        void executeEndSession();
      }
      return;
    }
    setShowConfirmEnd(true);
  };

  return (
    <Modal
      testID={testID}
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* Header Bar */}
        <View style={styles.header}>
          <Pressable
            testID="btn-close-focus-running"
            onPress={onClose}
            hitSlop={8}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Minimize focus screen"
          >
            <Ionicons name="chevron-down" size={26} color={colors.text} />
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {isRoom ? t('focus.roomFocusTitle') : t('focus.cardTitle')}
            </Text>
            {label ? (
              <View
                style={[
                  styles.labelPill,
                  { backgroundColor: colors.cardHighlight },
                ]}
              >
                <Text style={[styles.labelText, { color: colors.accent }]}>
                  {label}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isPaused
                  ? colors.surfaceAlt
                  : colors.cardHighlight,
                borderColor: isPaused ? colors.border : colors.accent,
              },
            ]}
          >
            <Ionicons
              name={isPaused ? 'pause-circle-outline' : 'sparkles-outline'}
              size={16}
              color={isPaused ? colors.textMuted : colors.accent}
            />
            <Text
              style={[
                styles.statusText,
                { color: isPaused ? colors.textMuted : colors.accent },
              ]}
            >
              {isPaused ? t('focus.pausedStatus') : t('focus.activeStatus')}
            </Text>
          </View>

          {/* Large Calm Timer Display */}
          <View style={styles.timeContainer}>
            <Text
              testID="text-focus-time"
              style={[styles.timeDigits, { color: colors.text }]}
              accessibilityRole="text"
              accessibilityLabel={accessibleTimeText}
            >
              {formatTimeDigits(displayedSeconds)}
            </Text>
            <Text style={[styles.timeCaption, { color: colors.textMuted }]}>
              {isTimer ? 'Remaining' : 'Focused Time'}
            </Text>
          </View>

          {/* Supportive Safeguard Prompts (PRD FOC-12) */}
          {showBreakPrompt && (
            <View
              testID="banner-break-prompt"
              style={[
                styles.promptCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name="cafe-outline"
                size={20}
                color={colors.accent}
              />
              <Text style={[styles.promptText, { color: colors.text }]}>
                {t('focus.breakPrompt')}
              </Text>
            </View>
          )}

          {showStillFocusing && (
            <View
              testID="banner-still-focusing"
              style={[
                styles.promptCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name="heart-outline"
                size={20}
                color={colors.accent}
              />
              <Text style={[styles.promptText, { color: colors.text }]}>
                {t('focus.stillFocusingPrompt')}
              </Text>
            </View>
          )}

          {showAutoStopNotice && (
            <View
              testID="banner-auto-stop"
              style={[
                styles.promptCard,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name="time-outline"
                size={20}
                color={colors.textMuted}
              />
              <Text style={[styles.promptText, { color: colors.textMuted }]}>
                Stopwatch reached the 12-hour maximum cap.
              </Text>
            </View>
          )}

          {/* Room Participants Section (If Room Focus) */}
          {isRoom && roomParticipants.length > 0 && (
            <View
              testID="list-room-participants"
              style={[
                styles.participantsCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[styles.participantsHeader, { color: colors.text }]}
              >
                {t('focus.participantsTitle')} ({roomParticipants.length})
              </Text>
              <View style={styles.participantsList}>
                {roomParticipants.map((p) => {
                  const pPaused = p.status === 'break';
                  return (
                    <View key={p.user_id} style={styles.participantRow}>
                      <View style={styles.participantInfo}>
                        <View
                          style={[
                            styles.avatarCircle,
                            { backgroundColor: colors.surfaceAlt },
                          ]}
                        >
                          <Ionicons
                            name="person"
                            size={14}
                            color={colors.text}
                          />
                        </View>
                        <Text
                          style={[
                            styles.participantName,
                            { color: colors.text },
                          ]}
                        >
                          {p.user_id}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.participantBadge,
                          {
                            backgroundColor: pPaused
                              ? colors.surfaceAlt
                              : colors.cardHighlight,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.participantBadgeText,
                            {
                              color: pPaused
                                ? colors.textMuted
                                : colors.accent,
                            },
                          ]}
                        >
                          {pPaused ? 'Break' : 'Focusing'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Primary Action Buttons */}
          <View style={styles.actionsRow}>
            {/* Pause / Resume Button */}
            <Pressable
              testID={isPaused ? 'btn-focus-resume' : 'btn-focus-pause'}
              onPress={handlePauseToggle}
              disabled={busy}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: isPaused
                    ? colors.accent
                    : colors.surfaceAlt,
                  borderColor: isPaused ? colors.accent : colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                isPaused ? t('focus.resumeBtn') : t('focus.pauseBtn')
              }
            >
              <Ionicons
                name={isPaused ? 'play' : 'pause'}
                size={22}
                color={isPaused ? colors.onAccent : colors.text}
              />
              <Text
                style={[
                  styles.actionBtnText,
                  { color: isPaused ? colors.onAccent : colors.text },
                ]}
              >
                {isPaused ? t('focus.resumeBtn') : t('focus.pauseBtn')}
              </Text>
            </Pressable>

            {/* End Button */}
            <Pressable
              testID="btn-focus-end"
              onPress={handleEndPress}
              disabled={busy}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('focus.endBtn')}
            >
              <Ionicons name="stop" size={22} color={colors.accent} />
              <Text
                style={[styles.actionBtnText, { color: colors.text }]}
              >
                {t('focus.endBtn')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* Native Confirmation Dialog */}
        {showConfirmEnd && (
          <Modal
            testID="modal-confirm-end"
            visible={showConfirmEnd}
            transparent
            animationType="fade"
            onRequestClose={() => setShowConfirmEnd(false)}
          >
            <View style={styles.confirmBackdrop}>
              <View
                style={[
                  styles.confirmCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.confirmTitle, { color: colors.text }]}
                >
                  {t('focus.confirmEndTitle')}
                </Text>
                <Text
                  style={[
                    styles.confirmMessage,
                    { color: colors.textMuted },
                  ]}
                >
                  {t('focus.confirmEndMessage')}
                </Text>

                <View style={styles.confirmActions}>
                  <Pressable
                    testID="btn-confirm-cancel"
                    style={[
                      styles.confirmBtn,
                      {
                        backgroundColor: colors.surfaceAlt,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => setShowConfirmEnd(false)}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.cancel')}
                  >
                    <Text
                      style={[
                        styles.confirmBtnText,
                        { color: colors.text },
                      ]}
                    >
                      {t('common.cancel')}
                    </Text>
                  </Pressable>

                  <Pressable
                    testID="btn-confirm-end-yes"
                    style={[
                      styles.confirmBtn,
                      { backgroundColor: colors.accent },
                    ]}
                    onPress={executeEndSession}
                    accessibilityRole="button"
                    accessibilityLabel={t('focus.endBtn')}
                  >
                    <Text
                      style={[
                        styles.confirmBtnText,
                        { color: colors.onAccent },
                      ]}
                    >
                      {t('focus.endBtn')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    padding: 8,
  },
  headerTitleWrap: {
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  labelPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.xl,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 6,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  timeContainer: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  timeDigits: {
    fontSize: 64,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  timeCaption: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    marginTop: 6,
  },
  promptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    maxWidth: 420,
    width: '100%',
  },
  promptText: {
    flex: 1,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  participantsCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  participantsHeader: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  participantsList: {
    gap: spacing.xs,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarCircle: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantName: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  participantBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  participantBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
    maxWidth: 360,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 8,
  },
  actionBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  confirmTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  confirmMessage: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  confirmBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
