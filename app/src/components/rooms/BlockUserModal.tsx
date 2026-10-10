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

interface BlockUserModalProps {
  visible: boolean;
  targetMember: RoomMemberSnapshot | null;
  onClose: () => void;
  onConfirmBlock: (targetUserId: string) => Promise<unknown>;
}

export function BlockUserModal({
  visible,
  targetMember,
  onClose,
  onConfirmBlock,
}: BlockUserModalProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [blockedToast, setBlockedToast] = useState(false);

  const handleBlock = async () => {
    if (!targetMember) return;
    setLoading(true);
    try {
      await onConfirmBlock(targetMember.user_id);
      setBlockedToast(true);
      setTimeout(() => {
        setBlockedToast(false);
        onClose();
      }, 1200);
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
                {t('rooms.blockModal.title')}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel="Close block modal"
              testID="btn-close-block-modal"
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* Warning Icon & Message */}
          <View style={styles.body}>
            <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="hand-left-outline" size={32} color={colors.danger} />
            </View>

            <Text style={[styles.message, { color: colors.text }]}>
              {t('rooms.blockModal.message', {
                username: targetMember?.username ?? 'user',
              })}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <Pressable
              onPress={onClose}
              disabled={loading}
              style={[styles.cancelButton, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel block"
              testID="btn-cancel-block"
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                {t('common.cancel')}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleBlock}
              disabled={loading}
              style={[styles.blockButton, { backgroundColor: colors.danger }]}
              accessibilityRole="button"
              accessibilityLabel="Confirm block user"
              testID="btn-confirm-block"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.blockButtonText}>
                  {blockedToast ? t('rooms.blockModal.blockedToast') : t('rooms.blockModal.confirmBtn')}
                </Text>
              )}
            </Pressable>
          </View>
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
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.md + 2,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  message: {
    fontSize: fontSize.xs + 2,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  blockButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
