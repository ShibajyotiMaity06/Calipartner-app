import { Button } from '@calipartner/ui';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@calipartner/ui';
import * as Clipboard from 'expo-clipboard';
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
  onBlockMember?: (userId: string) => Promise<void>;
  onReply?: (message: ChatMessage) => void;
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
  onBlockMember,
  onReply,
  testID = 'chat-message-menu-modal',
}: ChatMessageMenuModalProps) {
  const { colors } = useTheme();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const [actionError, setActionError] = useState(false);
  useEffect(() => {
    setShowDeleteConfirm(false);
    setShowBlockConfirm(false);
    setActionError(false);
  }, [message?.id, visible]);
  if (!message) return null;

  const handleCopy = async () => {
    if (!message.text) return;
    try {
      await Clipboard.setStringAsync(message.text);
    } catch {
      setActionError(true);
      return;
    }
    onClose();
  };

  const handleConfirmDelete = async () => {
    setLoading(true);
    setActionError(false);
    try {
      await onDeleteMessage(message.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch {
      setActionError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmBlock = async () => {
    if (!message.sender_id || !onBlockMember) return;
    setLoading(true);
    setActionError(false);
    try {
      await onBlockMember(message.sender_id);
      setShowBlockConfirm(false);
      onClose();
    } catch {
      setActionError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleMute = async () => {
    if (!message.sender_id) return;
    setLoading(true);
    setActionError(false);
    try {
      await onMuteMember(message.sender_id);
      onClose();
    } catch {
      setActionError(true);
    } finally {
      setLoading(false);
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
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[styles.sheetContainer, { backgroundColor: colors.surface }]}
        >
          {actionError ? (
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              {t('chatAudit.actionError')}
            </Text>
          ) : null}
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
                <Button
                  variant="destructive"
                  label={t('chat.deleteConfirmBtn')}
                  onPress={handleConfirmDelete}
                  disabled={loading}
                  style={[styles.confirmBtn, { backgroundColor: colors.danger }]}
                  accessibilityRole="button"
                  testID="btn-delete-confirm"
                />
                <Button
                  variant="cancel"
                  label={t('chat.cancel')}
                  onPress={() => setShowDeleteConfirm(false)}
                  accessibilityRole="button"
                  testID="btn-delete-cancel"
                />
              </View>
            </View>
          ) : showBlockConfirm ? (
            <View style={styles.deleteConfirmBox} testID="box-block-confirm">
              <Text style={[styles.deleteConfirmTitle, { color: colors.danger }]}>Block user</Text>
              <Text style={[styles.deleteConfirmDesc, { color: colors.textMuted }]}>
                Are you sure you want to block this user? You will immediately stop seeing their
                messages, activity, and shared logs.
              </Text>

              <View style={styles.confirmButtonsRow}>
                <Button
                  variant="destructive"
                  label="Block User"
                  onPress={handleConfirmBlock}
                  disabled={loading}
                  style={[styles.confirmBtn, { backgroundColor: colors.danger }]}
                  accessibilityRole="button"
                  testID="btn-block-confirm"
                />
                <Button
                  variant="cancel"
                  label={t('chat.cancel')}
                  onPress={() => setShowBlockConfirm(false)}
                  accessibilityRole="button"
                  testID="btn-block-cancel"
                />
              </View>
            </View>
          ) : (
            <>
              {onReply && !message.deleted_at && message.message_type === 'user' && (
                <Button
                  variant="secondary"
                  fullWidth={false}
                  label={t('aha.reply')}
                  icon={
                    <Ionicons
                      name="arrow-undo-outline"
                      size={20}
                      color={colors.text}
                      style={styles.optionIcon}
                    />
                  }
                  onPress={() => {
                    onReply(message);
                    onClose();
                  }}
                  style={styles.menuOptionRow}
                  accessibilityRole="button"
                  accessibilityLabel={t('aha.reply')}
                  testID="btn-reply-message"
                />
              )}
              {/* Option: Copy Text */}
              {Boolean(message.text) && (
                <Button
                  variant="secondary"
                  fullWidth={false}
                  label={t('chat.copyText')}
                  icon={
                    <Ionicons
                      name="copy-outline"
                      size={20}
                      color={colors.text}
                      style={styles.optionIcon}
                    />
                  }
                  onPress={handleCopy}
                  style={[styles.menuOptionRow, { borderBottomColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.copyText')}
                  testID="btn-copy-text"
                />
              )}

              {/* Option: Delete Own Message */}
              {isMine && !message.deleted_at && (
                <Button
                  variant="destructive"
                  fullWidth={false}
                  label={t('chat.deleteOwn')}
                  icon={
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={colors.danger}
                      style={styles.optionIcon}
                    />
                  }
                  onPress={() => setShowDeleteConfirm(true)}
                  style={[styles.menuOptionRow, { borderBottomColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.deleteOwn')}
                  testID="btn-delete-message"
                />
              )}

              {/* Options for other member's message */}
              {!isMine && (
                <>
                  <Button
                    variant="destructive"
                    fullWidth={false}
                    label={t('chat.reportMsg')}
                    icon={
                      <Ionicons
                        name="flag-outline"
                        size={20}
                        color={colors.danger}
                        style={styles.optionIcon}
                      />
                    }
                    onPress={() => {
                      onClose();
                      onReportMessage(message.id);
                    }}
                    style={[styles.menuOptionRow, { borderBottomColor: colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel={t('chat.reportMsg')}
                    testID="btn-report-message"
                  />

                  {message.sender_id && onBlockMember && (
                    <Pressable
                      onPress={() => setShowBlockConfirm(true)}
                      style={[styles.menuOptionRow, { borderBottomColor: colors.border }]}
                      accessibilityRole="button"
                      accessibilityLabel="Block user"
                      testID="btn-block-member"
                    >
                      <Ionicons
                        name="ban-outline"
                        size={20}
                        color={colors.danger}
                        style={styles.optionIcon}
                      />
                      <Text style={[styles.optionLabel, { color: colors.danger }]}>
                        Block {message.sender_nickname || 'Member'}
                      </Text>
                    </Pressable>
                  )}

                  {message.sender_id && (
                    <Button
                      variant="secondary"
                      fullWidth={false}
                      label={t('chat.muteMember', {
                        username: message.sender_nickname || 'Member',
                      })}
                      icon={
                        <Ionicons
                          name="volume-mute-outline"
                          size={20}
                          color={colors.textMuted}
                          style={styles.optionIcon}
                        />
                      }
                      onPress={handleMute}
                      style={[styles.menuOptionRow, { borderBottomColor: colors.border }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Mute member`}
                      testID="btn-mute-member"
                    />
                  )}
                </>
              )}

              {/* Cancel Button */}
              <Button
                variant="cancel"
                label={t('chat.cancel')}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t('chat.cancel')}
                testID="btn-menu-cancel"
              />
            </>
          )}
        </Pressable>
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
    gap: spacing.sm,
  },
  confirmBtn: {
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
