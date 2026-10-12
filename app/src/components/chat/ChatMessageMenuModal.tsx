import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ChatMessage } from '@/types/chat';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface ChatMessageMenuModalProps {
  visible: boolean;
  message: ChatMessage | null;
  isMine: boolean;
  onClose: () => void;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onReportMessage: (messageId: string) => void;
  onMuteMember: (userId: string) => Promise<void>;
  testID?: string;
}

export function ChatMessageMenuModal({
  visible,
  message,
  isMine,
  onClose,
  onDeleteMessage,
  onReportMessage,
  onMuteMember,
  testID = 'chat-message-menu-modal',
}: ChatMessageMenuModalProps) {
  const { colors } = useTheme();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!message) return null;

  const handleCopy = async () => {
    if (!message.text) return;
    try {
      const nav =
        typeof navigator !== 'undefined'
          ? (navigator as unknown as { clipboard?: { writeText: (text: string) => Promise<void> } })
          : undefined;
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(message.text);
      } else {
        await Share.share({ message: message.text });
      }
    } catch {
      // Ignore
    }
    onClose();
  };

  const handleConfirmDelete = async () => {
    setLoading(true);
    try {
      await onDeleteMessage(message.id);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  const handleMute = async () => {
    if (!message.sender_id) return;
    setLoading(true);
    try {
      await onMuteMember(message.sender_id);
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID={testID}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.sheetContainer, { backgroundColor: colors.surface }]}>
          <View style={[styles.handleIndicator, { backgroundColor: colors.border }]} />

          <Text style={[styles.title, { color: colors.text }]}>{t('chat.longPressTitle')}</Text>

          {/* Delete confirmation dialog view */}
          {showDeleteConfirm ? (
            <View style={styles.deleteConfirmBox} testID="box-delete-confirm">
              <Text style={[styles.deleteConfirmTitle, { color: colors.danger }]}>
                {t('chat.deleteConfirmTitle')}
              </Text>
              <Text style={[styles.deleteConfirmDesc, { color: colors.textMuted }]}>
                {t('chat.deleteConfirmMessage')}
              </Text>

              <View style={styles.confirmButtonsRow}>
                <Pressable
                  onPress={() => setShowDeleteConfirm(false)}
                  style={[styles.confirmBtn, { backgroundColor: colors.surfaceAlt }]}
                  accessibilityRole="button"
                  testID="btn-delete-cancel"
                >
                  <Text style={[styles.confirmBtnText, { color: colors.text }]}>
                    {t('chat.cancel')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleConfirmDelete}
                  disabled={loading}
                  style={[styles.confirmBtn, { backgroundColor: colors.danger }]}
                  accessibilityRole="button"
                  testID="btn-delete-confirm"
                >
                  <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>
                    {t('chat.deleteConfirmBtn')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {/* Option: Copy Text */}
              {Boolean(message.text) && (
                <Pressable
                  onPress={handleCopy}
                  style={[styles.menuOptionRow, { borderBottomColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.copyText')}
                  testID="btn-copy-text"
                >
                  <Ionicons name="copy-outline" size={20} color={colors.text} style={styles.optionIcon} />
                  <Text style={[styles.optionLabel, { color: colors.text }]}>{t('chat.copyText')}</Text>
                </Pressable>
              )}

              {/* Option: Delete Own Message */}
              {isMine && !message.deleted_at && (
                <Pressable
                  onPress={() => setShowDeleteConfirm(true)}
                  style={[styles.menuOptionRow, { borderBottomColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.deleteOwn')}
                  testID="btn-delete-message"
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} style={styles.optionIcon} />
                  <Text style={[styles.optionLabel, { color: colors.danger }]}>{t('chat.deleteOwn')}</Text>
                </Pressable>
              )}

              {/* Options for other member's message */}
              {!isMine && (
                <>
                  <Pressable
                    onPress={() => {
                      onClose();
                      onReportMessage(message.id);
                    }}
                    style={[styles.menuOptionRow, { borderBottomColor: colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel={t('chat.reportMsg')}
                    testID="btn-report-message"
                  >
                    <Ionicons name="flag-outline" size={20} color={colors.danger} style={styles.optionIcon} />
                    <Text style={[styles.optionLabel, { color: colors.danger }]}>{t('chat.reportMsg')}</Text>
                  </Pressable>

                  {message.sender_id && (
                    <Pressable
                      onPress={handleMute}
                      style={[styles.menuOptionRow, { borderBottomColor: colors.border }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Mute member`}
                      testID="btn-mute-member"
                    >
                      <Ionicons name="volume-mute-outline" size={20} color={colors.textMuted} style={styles.optionIcon} />
                      <Text style={[styles.optionLabel, { color: colors.text }]}>
                        {t('chat.muteMember', { username: message.sender_nickname || 'Member' })}
                      </Text>
                    </Pressable>
                  )}
                </>
              )}

              {/* Cancel Button */}
              <Pressable
                onPress={onClose}
                style={[styles.cancelBtn, { backgroundColor: colors.surfaceAlt }]}
                accessibilityRole="button"
                accessibilityLabel={t('chat.cancel')}
                testID="btn-menu-cancel"
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>{t('chat.cancel')}</Text>
              </Pressable>
            </>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  handleIndicator: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  menuOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionIcon: {
    marginRight: spacing.md,
  },
  optionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  cancelBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  // Delete confirm box
  deleteConfirmBox: {
    paddingVertical: spacing.sm,
  },
  deleteConfirmTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  deleteConfirmDesc: {
    fontSize: fontSize.xs,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  confirmButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
