import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FocusSessionMode } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface FocusStartModalProps {
  visible: boolean;
  onClose: () => void;
  onStartPersonal: (
    mode: FocusSessionMode,
    label?: string | null,
    plannedSeconds?: number | null,
  ) => Promise<unknown>;
  onStartRoom?: (
    mode: FocusSessionMode,
    label?: string | null,
    plannedSeconds?: number | null,
  ) => Promise<unknown>;
  roomId?: string | null;
  roomName?: string | null;
  isRoomLocked?: boolean;
  testID?: string;
}

const QUICK_LENGTHS = [25, 50, 90] as const;
const SUGGESTED_LABELS = ['Study', 'Work', 'Reading', 'Coding', 'Writing'] as const;

export function FocusStartModal({
  visible,
  onClose,
  onStartPersonal,
  onStartRoom,
  roomId,
  roomName,
  isRoomLocked = false,
  testID = 'focus-start-modal',
}: FocusStartModalProps) {
  const { colors } = useTheme();

  const [mode, setMode] = useState<FocusSessionMode>('timer');
  const [selectedQuickLen, setSelectedQuickLen] = useState<number | null>(25);
  const [customLenMinutes, setCustomLenMinutes] = useState<string>('');
  const [isCustomLen, setIsCustomLen] = useState<boolean>(false);
  const [label, setLabel] = useState<string>('');
  const [targetScope, setTargetScope] = useState<'personal' | 'room'>('personal');
  const [busy, setBusy] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleQuickLenSelect = (len: number) => {
    setIsCustomLen(false);
    setSelectedQuickLen(len);
    setCustomLenMinutes('');
  };

  const handleCustomLenFocus = () => {
    setIsCustomLen(true);
    setSelectedQuickLen(null);
  };

  const handleLabelChipPress = (chip: string) => {
    if (label === chip) {
      setLabel('');
    } else {
      setLabel(chip);
    }
  };

  const handleStart = async () => {
    setErrorMsg(null);
    let plannedSeconds: number | null = null;

    if (mode === 'timer') {
      let minutes = 25;
      if (isCustomLen) {
        const parsed = parseInt(customLenMinutes.trim(), 10);
        if (isNaN(parsed) || parsed < 1 || parsed > 720) {
          setErrorMsg('Please enter a valid duration between 1 and 720 minutes.');
          return;
        }
        minutes = parsed;
      } else if (selectedQuickLen) {
        minutes = selectedQuickLen;
      }
      plannedSeconds = minutes * 60;
    }

    const trimmedLabel = label.trim() ? label.trim().slice(0, 20) : null;

    try {
      setBusy(true);
      if (targetScope === 'room' && onStartRoom) {
        if (isRoomLocked) {
          setErrorMsg(t('focus.roomLockedNotice'));
          return;
        }
        await onStartRoom(mode, trimmedLabel, plannedSeconds);
      } else {
        await onStartPersonal(mode, trimmedLabel, plannedSeconds);
      }
      onClose();
    } catch (err: unknown) {
      const errString = String(err);
      if (errString.includes('RATE_LIMITED')) {
        setErrorMsg(t('focus.rateLimitNotice'));
      } else if (errString.includes('ROOM_LOCKED')) {
        setErrorMsg(t('focus.roomLockedNotice'));
      } else {
        setErrorMsg((err as { message?: string })?.message || t('common.errorBody'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      testID={testID}
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheetContainer,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>{t('focus.startBtn')}</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {t('focus.cardSubtitle')}
              </Text>
            </View>
            <Pressable
              testID="btn-close-focus-start"
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Scope Selector if room is provided */}
            {Boolean(roomId && onStartRoom) && (
              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('focus.mode')}
                </Text>
                <View style={[styles.toggleContainer, { backgroundColor: colors.surfaceAlt }]}>
                  <Pressable
                    testID="btn-scope-personal"
                    style={[
                      styles.toggleTab,
                      targetScope === 'personal' && [
                        styles.toggleTabActive,
                        { backgroundColor: colors.surface },
                      ],
                    ]}
                    onPress={() => setTargetScope('personal')}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: targetScope === 'personal' }}
                  >
                    <Ionicons
                      name="person-outline"
                      size={16}
                      color={targetScope === 'personal' ? colors.text : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.toggleText,
                        { color: targetScope === 'personal' ? colors.text : colors.textMuted },
                      ]}
                    >
                      Personal
                    </Text>
                  </Pressable>

                  <Pressable
                    testID="btn-scope-room"
                    style={[
                      styles.toggleTab,
                      targetScope === 'room' && [
                        styles.toggleTabActive,
                        { backgroundColor: colors.surface },
                      ],
                    ]}
                    onPress={() => setTargetScope('room')}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: targetScope === 'room' }}
                  >
                    <Ionicons
                      name="people-outline"
                      size={16}
                      color={targetScope === 'room' ? colors.text : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.toggleText,
                        { color: targetScope === 'room' ? colors.text : colors.textMuted },
                      ]}
                    >
                      {roomName ? `Room: ${roomName}` : 'Room'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Mode Selector: Stopwatch vs Timer */}
            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('focus.mode')}
              </Text>
              <View style={styles.modeRow}>
                <Pressable
                  testID="btn-mode-timer"
                  style={[
                    styles.modeCard,
                    {
                      backgroundColor: mode === 'timer' ? colors.cardHighlight : colors.surfaceAlt,
                      borderColor: mode === 'timer' ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => setMode('timer')}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: mode === 'timer' }}
                  accessibilityLabel="Timer mode with countdown"
                >
                  <Ionicons
                    name="hourglass-outline"
                    size={24}
                    color={mode === 'timer' ? colors.accent : colors.textMuted}
                  />
                  <Text style={[styles.modeTitle, { color: colors.text }]}>
                    {t('focus.timer')}
                  </Text>
                  <Text style={[styles.modeDesc, { color: colors.textMuted }]}>
                    Countdown from chosen length
                  </Text>
                </Pressable>

                <Pressable
                  testID="btn-mode-stopwatch"
                  style={[
                    styles.modeCard,
                    {
                      backgroundColor:
                        mode === 'stopwatch' ? colors.cardHighlight : colors.surfaceAlt,
                      borderColor: mode === 'stopwatch' ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => setMode('stopwatch')}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: mode === 'stopwatch' }}
                  accessibilityLabel="Stopwatch mode counting up"
                >
                  <Ionicons
                    name="timer-outline"
                    size={24}
                    color={mode === 'stopwatch' ? colors.accent : colors.textMuted}
                  />
                  <Text style={[styles.modeTitle, { color: colors.text }]}>
                    {t('focus.stopwatch')}
                  </Text>
                  <Text style={[styles.modeDesc, { color: colors.textMuted }]}>
                    Open-ended count up
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Timer Length Options (Only in Timer Mode) */}
            {mode === 'timer' && (
              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('focus.quickLengths')}
                </Text>
                <View style={styles.chipsRow}>
                  {QUICK_LENGTHS.map((len) => {
                    const isSelected = !isCustomLen && selectedQuickLen === len;
                    return (
                      <Pressable
                        key={len}
                        testID={`chip-len-${len}`}
                        onPress={() => handleQuickLenSelect(len)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected ? colors.accent : colors.surfaceAlt,
                            borderColor: isSelected ? colors.accent : colors.border,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${len} minutes`}
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: isSelected ? colors.onAccent : colors.text },
                          ]}
                        >
                          {len} {t('focus.minutesUnit')}
                        </Text>
                      </Pressable>
                    );
                  })}

                  <Pressable
                    testID="chip-len-custom"
                    onPress={handleCustomLenFocus}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isCustomLen ? colors.accent : colors.surfaceAlt,
                        borderColor: isCustomLen ? colors.accent : colors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Custom length in minutes"
                    accessibilityState={{ selected: isCustomLen }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isCustomLen ? colors.onAccent : colors.text },
                      ]}
                    >
                      {t('focus.customLength')}
                    </Text>
                  </Pressable>
                </View>

                {/* Custom length text input */}
                {isCustomLen && (
                  <View style={styles.customInputRow}>
                    <TextInput
                      testID="input-custom-length"
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.surfaceAlt,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      keyboardType="number-pad"
                      placeholder={t('focus.customPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      value={customLenMinutes}
                      onChangeText={setCustomLenMinutes}
                      maxLength={3}
                      accessibilityLabel={t('focus.customLength')}
                    />
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                      {t('focus.minutesUnit')}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Optional Label */}
            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('focus.labelTitle')}
              </Text>
              <View style={styles.chipsRow}>
                {SUGGESTED_LABELS.map((item) => {
                  const isSelected = label.toLowerCase() === item.toLowerCase();
                  return (
                    <Pressable
                      key={item}
                      testID={`chip-label-${item.toLowerCase()}`}
                      onPress={() => handleLabelChipPress(item)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected ? colors.accent : colors.surfaceAlt,
                          borderColor: isSelected ? colors.accent : colors.border,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={item}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: isSelected ? colors.onAccent : colors.text },
                        ]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                testID="input-focus-label"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderColor: colors.border,
                    color: colors.text,
                    marginTop: spacing.xs,
                  },
                ]}
                placeholder={t('focus.labelPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={label}
                onChangeText={(text) => setLabel(text.slice(0, 20))}
                maxLength={20}
                accessibilityLabel="Session label up to 20 characters"
              />
            </View>

            {/* Error Message Banner */}
            {Boolean(errorMsg) && (
              <View
                testID="banner-focus-start-error"
                style={[
                  styles.errorBanner,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                ]}
              >
                <Ionicons name="alert-circle-outline" size={18} color={colors.accent} />
                <Text style={[styles.errorText, { color: colors.text }]}>{errorMsg}</Text>
              </View>
            )}

            {/* Locked Room Notice */}
            {targetScope === 'room' && isRoomLocked && (
              <View
                testID="banner-room-locked-warning"
                style={[
                  styles.errorBanner,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                ]}
              >
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                <Text style={[styles.errorText, { color: colors.textMuted }]}>
                  {t('focus.roomLockedNotice')}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Action Button */}
          <Pressable
            testID="btn-start-focus"
            onPress={handleStart}
            disabled={busy || (targetScope === 'room' && isRoomLocked)}
            style={[
              styles.startBtn,
              {
                backgroundColor:
                  targetScope === 'room' && isRoomLocked ? colors.surfaceAlt : colors.accent,
                opacity: busy ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              targetScope === 'room' ? t('focus.startRoom') : t('focus.startPersonal')
            }
          >
            {busy ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={[styles.startBtnText, { color: colors.onAccent }]}>
                {targetScope === 'room' ? t('focus.startRoom') : t('focus.startPersonal')}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    maxHeight: '90%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 36,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionWrap: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 4,
  },
  toggleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm,
    gap: 6,
  },
  toggleTabActive: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  modeTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  modeDesc: {
    fontSize: 10,
    textAlign: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fontSize.sm,
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
  startBtn: {
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});
