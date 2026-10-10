import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RoomMemberSnapshot } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface NudgeModalProps {
  visible: boolean;
  targetMember: RoomMemberSnapshot | null;
  onClose: () => void;
  onSendNudge: (targetUserId: string, message: string) => Promise<unknown>;
}

export function NudgeModal({
  visible,
  targetMember,
  onClose,
  onSendNudge,
}: NudgeModalProps) {
  const { colors } = useTheme();

  const options = [
    { id: 'lunch', text: t('rooms.nudgeModal.optionLunch') },
    { id: 'water', text: t('rooms.nudgeModal.optionWater') },
    { id: 'workout', text: t('rooms.nudgeModal.optionWorkout') },
    { id: 'checkin', text: t('rooms.nudgeModal.optionCheckin') },
  ];

  const [selectedOption, setSelectedOption] = useState<string>(options[0]!.text);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState(false);

  const handleSend = async () => {
    if (!targetMember) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await onSendNudge(targetMember.user_id, selectedOption);
      setSuccessToast(true);
      setTimeout(() => {
        setSuccessToast(false);
        onClose();
      }, 1200);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('rooms.nudgeModal.title')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {t('rooms.nudgeModal.subtitle')}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel="Close nudge modal"
              testID="btn-close-nudge-modal"
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* Recipient info pill */}
          {targetMember && (
            <View style={[styles.targetPill, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.targetLabel, { color: colors.textMuted }]}>To:</Text>
              <Text style={[styles.targetName, { color: colors.text }]}>
                {targetMember.nickname} (@{targetMember.username})
              </Text>
            </View>
          )}

          {/* Options List */}
          <View style={styles.optionsList}>
            {options.map((opt) => {
              const isSelected = selectedOption === opt.text;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setSelectedOption(opt.text)}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: isSelected ? colors.cardHighlight : colors.surfaceAlt,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  testID={`nudge-option-${opt.id}`}
                >
                  <Text style={[styles.optionText, { color: colors.text }]}>{opt.text}</Text>
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={isSelected ? colors.accent : colors.textMuted}
                  />
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.limitHint, { color: colors.textMuted }]}>
            {t('rooms.nudgeModal.limitNotice')}
          </Text>

          {errorMsg && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>{errorMsg}</Text>
            </View>
          )}

          {/* Send Button */}
          <Pressable
            onPress={handleSend}
            disabled={loading}
            style={[styles.sendButton, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Send nudge"
            testID="btn-send-nudge-submit"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendButtonText}>
                {successToast ? t('rooms.nudgeModal.sentToast') : t('rooms.nudgeModal.sendBtn')}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.md + 2,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  targetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
    gap: 6,
  },
  targetLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  targetName: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  optionsList: {
    gap: spacing.xs + 2,
    marginBottom: spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  optionText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  limitHint: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: spacing.sm,
    fontStyle: 'italic',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
    justifyContent: 'center',
  },
  errorText: {
    fontSize: fontSize.xs,
  },
  sendButton: {
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
